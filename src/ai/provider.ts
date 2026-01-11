/**
 * AI Provider Interface
 * Supports OpenAI with structured outputs
 */

import { z } from "zod";

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIResponse<T> {
  data: T;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Base AI Provider interface
 */
export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;
  protected baseUrl?: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.getDefaultModel();
    this.baseUrl = config.baseUrl;
  }

  abstract getDefaultModel(): string;

  abstract callWithSchema<T extends z.ZodTypeAny>(
    systemPrompt: string,
    userPrompt: string,
    schema: T
  ): Promise<AIResponse<z.infer<T>>>;
}

/**
 * OpenAI Provider with structured outputs
 */
export class OpenAIProvider extends BaseAIProvider {
  getDefaultModel(): string {
    return "gpt-4o-mini";
  }

  async callWithSchema<T extends z.ZodTypeAny>(
    systemPrompt: string,
    userPrompt: string,
    schema: T
  ): Promise<AIResponse<z.infer<T>>> {
    const url = this.baseUrl || "https://api.openai.com/v1/chat/completions";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,  // Enable strict mode with nullable fields
            schema: zodToJsonSchema(schema),
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const result = await response.json();

    // Parse the response content
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);

    // With strict mode enabled, OpenAI validates against the schema
    // so we can directly parse and validate
    try {
      const validated = schema.parse(parsed);
      return {
        data: validated,
        usage: result.usage,
      };
    } catch (error) {
      // Log the actual response for debugging
      console.error("Schema validation failed. OpenAI response:", JSON.stringify(parsed, null, 2));
      throw error;
    }
  }
}

/**
 * Convert Zod schema to JSON Schema for OpenAI
 * (Simplified version - production should use zod-to-json-schema library)
 */
function zodToJsonSchema(schema: z.ZodTypeAny): any {
  // This is a simplified implementation
  // In production, use: import { zodToJsonSchema } from "zod-to-json-schema"
  
  const def = (schema as any)._def;
  
  if (schema instanceof z.ZodObject) {
    const shape = def.shape();
    const properties: any = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      properties[key] = zodToJsonSchema(fieldSchema);
      
      // Check if field is optional by checking if it's a ZodOptional instance
      if (!(fieldSchema instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }
  
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(def.type),
    };
  }
  
  if (schema instanceof z.ZodString) {
    const result: any = { type: "string" };
    // Add description from schema if available
    const description = (schema as any).description;
    if (description) result.description = description;
    return result;
  }
  
  if (schema instanceof z.ZodNumber) {
    const result: any = { type: "number" };
    // Add integer constraint if present
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === "int") {
          result.type = "integer";
        }
      }
    }
    return result;
  }
  
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: def.values,
    };
  }
  
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(def.innerType);
  }
  
  if (schema instanceof z.ZodNullable) {
    const inner = zodToJsonSchema(def.innerType);
    // For OpenAI strict mode, use anyOf with null type
    return {
      anyOf: [
        inner,
        { type: "null" }
      ]
    };
  }
  
  // Fallback
  return { type: "string" };
}

/**
 * Create AI provider from config
 */
export function createAIProvider(config: AIProviderConfig): BaseAIProvider {
  // For now, only OpenAI
  // TODO: Add Anthropic and OpenAI-compatible providers
  return new OpenAIProvider(config);
}
