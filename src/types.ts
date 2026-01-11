import { z } from "zod";

// ============================================================================
// File Change Types
// ============================================================================

export const FileChangeSchema = z.object({
  filename: z.string(),
  status: z.string(),
  patch: z.string().nullable().describe("Patch content, null if not available"),
  additions: z.number(),
  deletions: z.number(),
  tokens: z.number().nullable().describe("Token count, null if not calculated"),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

// ============================================================================
// Python Token Manager Types
// ============================================================================

export const TokenManagerInputSchema = z.object({
  files: z.array(FileChangeSchema),
  model: z.string().default("gpt-4o"),
  max_tokens: z.number().default(8000),
  prompt_tokens: z.number().default(0),
});

export type TokenManagerInput = z.infer<typeof TokenManagerInputSchema>;

export const TokenManagerOutputSchema = z.object({
  chunks: z.array(z.array(FileChangeSchema)),
  total_tokens: z.number(),
  files_included: z.number(),
  files_excluded: z.number(),
  excluded_files: z.array(z.string()),
  compression_stats: z.object({
    original_tokens: z.number(),
    after_deletion_removal: z.number(),
    after_packing: z.number().nullable().describe("Tokens after packing, null if not applicable"),
    savings_percent: z.number(),
    chunks: z.number(),
  }),
});

export type TokenManagerOutput = z.infer<typeof TokenManagerOutputSchema>;

// ============================================================================
// Review Issue Types (inspired by Saltman)
// ============================================================================

export const SEVERITY_VALUES = ["critical", "high", "medium", "low", "info"] as const;
export const SeveritySchema = z.enum(SEVERITY_VALUES);
export type Severity = z.infer<typeof SeveritySchema>;

export const EXPLOITABILITY_VALUES = ["easy", "medium", "hard"] as const;
export const ExploitabilitySchema = z.enum(EXPLOITABILITY_VALUES);
export type Exploitability = z.infer<typeof ExploitabilitySchema>;

export const IMPACT_VALUES = [
  "system_compromise",
  "data_breach",
  "privilege_escalation",
  "information_disclosure",
  "denial_of_service",
  "data_modification",
  "minimal",
] as const;
export const ImpactSchema = z.enum(IMPACT_VALUES);
export type Impact = z.infer<typeof ImpactSchema>;

export const SECURITY_CATEGORY_VALUES = [
  "injection",
  "authentication",
  "authorization",
  "cryptography",
  "xss",
  "xxe",
  "deserialization",
  "ssrf",
  "csrf",
  "idor",
  "secrets",
  "config",
  "logging",
  "api",
  "other",
] as const;
export const SecurityCategorySchema = z.enum(SECURITY_CATEGORY_VALUES);
export type SecurityCategory = z.infer<typeof SecurityCategorySchema>;

export const LocationSchema = z
  .object({
    file: z.string().describe("File path where the issue is located"),
    startLine: z.number().int().positive().describe("Starting line number"),
    endLine: z.number().int().positive().describe("Ending line number"),
  })
  .describe("Location of the issue in the codebase");

export type Location = z.infer<typeof LocationSchema>;

export const ReviewIssueSchema = z.object({
  title: z.string().describe("Concise title (3-8 words)"),
  severity: SeveritySchema,
  description: z.string().describe("Brief 2-line summary"),
  explanation: z.string().describe("Detailed explanation of the issue"),
  location: LocationSchema.nullable().describe("Location of the issue in the codebase"),
  suggestion: z.string().nullable().describe("Fix suggestion"),
  codeSnippet: z.string().nullable().describe("Code example for fix"),
  // Security-specific (null for quality reviews)
  securityCategory: SecurityCategorySchema.nullable().describe("Security category, null for non-security issues"),
  exploitability: ExploitabilitySchema.nullable().describe("How easy to exploit, null for non-security issues"),
  impact: ImpactSchema.nullable().describe("Potential impact, null for non-security issues"),
});

export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewResponseSchema = z.object({
  issues: z.array(ReviewIssueSchema),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

// ============================================================================
// Code Suggestion Types
// ============================================================================

export const CodeSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: LocationSchema.nullable().describe("Location of the suggestion"),
  original_code: z.string().nullable().describe("Original code to replace"),
  suggested_code: z.string(),
  reasoning: z.string(),
});

export type CodeSuggestion = z.infer<typeof CodeSuggestionSchema>;

export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(CodeSuggestionSchema),
});

export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

// ============================================================================
// PR Description Types
// ============================================================================

export const PRDescriptionSchema = z.object({
  title: z.string().nullable().describe("Optional title for the PR"),
  summary: z.string(),
  type: z.enum(["feature", "bugfix", "refactor", "docs", "chore", "test"]),
  changes: z.array(
    z.object({
      file: z.string(),
      change_type: z.enum(["added", "modified", "deleted"]),
      description: z.string(),
    })
  ),
  breaking_changes: z.array(z.string()).nullable().describe("List of breaking changes, or null if none"),
  related_issues: z.array(z.string()).nullable().describe("Related issue numbers, or null if none"),
});

export type PRDescription = z.infer<typeof PRDescriptionSchema>;

// ============================================================================
// Configuration Types
// ============================================================================

export const ProviderConfigSchema = z.object({
  name: z.enum(["openai", "anthropic", "openai-compatible"]).default("openai"),
  model: z.string().optional(),
  base_url: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ConfigSchema = z.object({
  provider: ProviderConfigSchema,
  features: z.object({
    security: z.object({ enabled: z.boolean().default(true) }).default({}),
    quality: z.object({ enabled: z.boolean().default(true) }).default({}),
    suggestions: z.object({ enabled: z.boolean().default(true) }).default({}),
    description: z.object({ enabled: z.boolean().default(true) }).default({}),
    incremental: z.object({ enabled: z.union([z.boolean(), z.literal("auto")]).default("auto") }).default({}),
    rag: z.object({ enabled: z.boolean().default(false) }).default({}),
  }),
  output: z.object({
    inline_comments: z.object({
      enabled: z.boolean().default(true),
      severity_threshold: SeveritySchema.default("high"),
    }).default({}),
    aggregated_comment: z.object({
      enabled: z.boolean().default(true),
      severity_threshold: SeveritySchema.default("medium"),
    }).default({}),
    persistent_comments: z.object({ enabled: z.boolean().default(true) }).default({}),
    post_when_no_issues: z.boolean().default(false),
  }),
  filters: z.object({
    ignore_patterns: z.array(z.string()).default([]),
    severity_filter: z.array(SeveritySchema).default([]),
  }),
  token_management: z.object({
    enabled: z.boolean().default(true),
    max_tokens_per_call: z.number().default(8000),
  }),
  performance: z.object({
    parallel_engines: z.boolean().default(true),
    max_cost_per_pr: z.number().default(0.30),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// GitHub Types
// ============================================================================

export interface PRContext {
  owner: string;
  repo: string;
  pull_number: number;
  head_sha: string;
}

export interface CommentLocation {
  path: string;
  start_line: number;
  end_line: number;
}

export interface InlineComment extends CommentLocation {
  body: string;
}
