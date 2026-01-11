#!/usr/bin/env bun
/**
 * PR Reviewer - Main Entry Point
 * 
 * Hybrid Bun+Python architecture for fast, comprehensive PR reviews
 */

import * as core from "@actions/core";
import { GitHubClient } from "./github/client";
import { pythonBridge } from "./python_bridge";
import { createAIProvider } from "./ai/provider";
import { SecurityEngine } from "./engines/security";
import { QualityEngine } from "./engines/quality";
import { SuggestionsEngine } from "./engines/suggestions";
import {
  separateIssuesBySeverity,
  formatInlineComment,
  formatAggregatedComment,
} from "./formatters";
import type { ReviewIssue, Severity } from "./types";

interface Config {
  githubToken: string;
  apiKey: string;
  provider: string;
  model?: string;
  mode: string;
  enableSecurity: boolean;
  enableQuality: boolean;
  enableSuggestions: boolean;
  inlineSeverityThreshold: Severity;
  aggregatedSeverityThreshold: Severity;
  ignorePatterns: string[];
  maxTokens: number;
}

async function run(): Promise<void> {
  try {
    core.info("🚀 PR Reviewer starting...");

    // 1. Load configuration
    const config = loadConfig();
    core.info(`Mode: ${config.mode}`);
    core.info(`Provider: ${config.provider}, Model: ${config.model || "default"}`);

    // 2. Test Python bridge
    core.info("🐍 Testing Python bridge...");
    const pythonTest = await pythonBridge.test();
    if (!pythonTest.success) {
      throw new Error(`Python bridge test failed: ${pythonTest.error}`);
    }
    core.info("✅ Python bridge ready");

    // 3. Get PR context
    const prContext = GitHubClient.getPRContext();
    if (!prContext) {
      throw new Error("Not running in a pull request context");
    }
    core.info(
      `📝 Reviewing PR #${prContext.pull_number} in ${prContext.owner}/${prContext.repo}`
    );

    // 4. Initialize GitHub client
    const github = new GitHubClient(config.githubToken);

    // 5. Fetch PR files
    core.info("📂 Fetching PR files...");
    let files = await github.getPRFiles(prContext);
    core.info(`Found ${files.length} changed files`);

    // 6. Filter files
    if (config.ignorePatterns.length > 0) {
      files = github.filterFiles(files, config.ignorePatterns);
      core.info(`After filtering: ${files.length} files`);
    }

    if (files.length === 0) {
      core.info("No files to review after filtering");
      return;
    }

    // 7. Token management (Python subprocess)
    core.info("🔢 Running token management...");
    const compressed = await pythonBridge.callTokenManager({
      files,
      model: config.model || "gpt-4o",
      max_tokens: config.maxTokens,
      prompt_tokens: 500, // Estimated prompt size
    });

    core.info(
      `Token management: ${compressed.files_included} files included, ${compressed.files_excluded} excluded`
    );
    core.info(
      `Compression savings: ${compressed.compression_stats.savings_percent}%`
    );
    core.info(`Chunks: ${compressed.chunks.length}`);

    if (compressed.files_excluded > 0) {
      core.warning(`Excluded ${compressed.files_excluded} files due to token budget:`);
      compressed.excluded_files.forEach((f) => core.warning(`  - ${f}`));
    }

    // 8. Initialize AI provider
    const aiProvider = createAIProvider({
      apiKey: config.apiKey,
      model: config.model,
    });

    // 9. Run review engines (process each chunk)
    const allIssues: ReviewIssue[] = [];

    for (let i = 0; i < compressed.chunks.length; i++) {
      const chunk = compressed.chunks[i];
      const chunkDiff = chunk
        .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
        .join("\n\n");

      core.info(
        `\n📊 Processing chunk ${i + 1}/${compressed.chunks.length} (${chunk.length} files)...`
      );

      // Run engines based on mode
      const engines = [];

      if (config.mode === "auto" || config.mode === "security-only") {
        if (config.enableSecurity) {
          engines.push(
            (async () => {
              core.info("  🔒 Security review...");
              const security = new SecurityEngine(aiProvider);
              return await security.analyze(chunkDiff);
            })()
          );
        }
      }

      if (config.mode === "auto" || config.mode === "quality-only") {
        if (config.enableQuality) {
          engines.push(
            (async () => {
              core.info("  ✨ Quality review...");
              const quality = new QualityEngine(aiProvider);
              return await quality.analyze(chunkDiff);
            })()
          );
        }
      }

      // Run engines in parallel
      const results = await Promise.all(engines);

      // Collect issues
      for (const result of results) {
        allIssues.push(...result.issues);
      }

      // Handle suggestions separately (optional)
      if (
        config.mode === "auto" ||
        config.mode === "suggest-only"
      ) {
        if (config.enableSuggestions) {
          core.info("  💡 Code suggestions...");
          const suggestions = new SuggestionsEngine(aiProvider);
          const suggestionsResult = await suggestions.generate(chunkDiff);
          // TODO: Post suggestions as separate comments
          core.info(`  Generated ${suggestionsResult.suggestions.length} suggestions`);
        }
      }
    }

    core.info(`\n✅ Analysis complete: ${allIssues.length} issues found`);

    if (allIssues.length === 0) {
      core.info("🎉 No issues detected!");
      return;
    }

    // 10. Separate issues by severity
    const { inline, aggregated } = separateIssuesBySeverity(
      allIssues,
      config.inlineSeverityThreshold,
      config.aggregatedSeverityThreshold
    );

    core.info(`Inline comments: ${inline.length}`);
    core.info(`Aggregated comments: ${aggregated.length}`);

    // 11. Post inline comments (critical/high)
    if (inline.length > 0) {
      core.info("\n💬 Posting inline comments...");
      for (const issue of inline) {
        const comment = formatInlineComment(issue, prContext);
        if (comment) {
          await github.postInlineComment(prContext, comment);
          core.info(`  Posted: ${issue.title} at ${comment.path}:${comment.start_line}`);
        }
      }
    }

    // 12. Post aggregated comment (medium/low/info)
    if (aggregated.length > 0) {
      core.info("\n📝 Posting aggregated comment...");
      const aggregatedBody = formatAggregatedComment(
        aggregated,
        prContext,
        inline.length > 0
      );
      await github.postComment(prContext, aggregatedBody);
      core.info("  Posted aggregated comment");
    }

    core.info("\n✨ PR review complete!");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
      core.error(error.stack || "");
    } else {
      core.setFailed("Unknown error occurred");
    }
  }
}

function loadConfig(): Config {
  // Read from environment variables directly (composite actions)
  const getEnvInput = (name: string, required = false): string => {
    const value = process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`] || "";
    if (required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  };

  return {
    githubToken: getEnvInput("github-token", true),
    apiKey: getEnvInput("openai-api-key", true),
    provider: getEnvInput("provider") || "openai",
    model: getEnvInput("model") || undefined,
    mode: getEnvInput("mode") || "auto",
    enableSecurity: getEnvInput("enable-security") !== "false",
    enableQuality: getEnvInput("enable-quality") !== "false",
    enableSuggestions: getEnvInput("enable-suggestions") !== "false",
    inlineSeverityThreshold:
      (getEnvInput("inline-severity-threshold") as Severity) || "high",
    aggregatedSeverityThreshold:
      (getEnvInput("aggregated-severity-threshold") as Severity) || "medium",
    ignorePatterns: getEnvInput("ignore-patterns")
      .split("\n")
      .filter((p) => p.trim()),
    maxTokens: parseInt(getEnvInput("max-tokens")) || 8000,
  };
}

// Run the action
run();
