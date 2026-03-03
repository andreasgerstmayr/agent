import { fileURLToPath, pathToFileURL } from "url";
import { readdir } from "fs/promises";
import { dirname, join, basename } from "path";
import Anthropic from "@anthropic-ai/sdk";

export type ToolResultContent = (
  | Anthropic.Messages.TextBlockParam
  | Anthropic.Messages.ImageBlockParam
)[];

export type ToolResult = string | ToolResultContent;

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type JsonSchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object";

type JsonTypeMap = {
  string: string;
  number: number;
  integer: number;
  boolean: boolean;
  array: unknown[];
  object: Record<string, unknown>;
};

type ParamDef = {
  type: JsonSchemaType;
  description: string;
  enum?: string[];
  items?: Record<string, unknown>;
};

type InferParam<P extends ParamDef> = JsonTypeMap[P["type"]];

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type InferInput<
  P extends Record<string, ParamDef>,
  R extends readonly string[],
> = Prettify<
  { [K in Extract<keyof P & string, R[number]>]: InferParam<P[K]> } &
  { [K in Exclude<keyof P & string, R[number]>]?: InferParam<P[K]> }
>;

export interface DefinedTool {
  definition: Anthropic.Messages.Tool;
  execute: (input: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
  timeout?: number;
}

/**
 * Define a tool with typed input inferred from params and required.
 * The `name` is optional — if omitted, it's derived from the filename by the loader.
 */
export function defineTool<
  const P extends Record<string, ParamDef> = {},
  const R extends readonly (keyof P & string)[] = [],
>(config: {
  name?: string;
  description: string;
  params?: P;
  required?: R;
  timeout?: number;
  execute: (input: InferInput<P, R>) => ToolResult | Promise<ToolResult>;
}): DefinedTool {
  return {
    definition: {
      name: config.name ?? "__unnamed__",
      description: config.description,
      input_schema: {
        type: "object" as const,
        properties: config.params ?? {},
        ...(config.required ? { required: [...config.required] } : {}),
      },
    },
    execute: config.execute as (input: Record<string, unknown>) => ToolResult | Promise<ToolResult>,
    timeout: config.timeout,
  };
}

export const srcDir = dirname(fileURLToPath(import.meta.url));
export const toolsDir = join(srcDir, "tools");

const DEFAULT_TIMEOUT = 30_000;

export async function loadTools(): Promise<{
  toolDefinitions: Anthropic.Messages.Tool[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolResult>;
}> {
  const files = await readdir(toolsDir);
  const toolFiles = files.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  const tools: DefinedTool[] = await Promise.all(
    toolFiles.map(async (f) => {
      const url = pathToFileURL(join(toolsDir, f)).href;
      const mod = await import(`${url}?t=${Date.now()}`);

      // Support default export (new style) or named exports (legacy)
      const tool: DefinedTool = mod.default ?? mod;

      // Auto-derive tool name from filename if not set
      if (tool.definition.name === "__unnamed__") {
        tool.definition.name = basename(f, ".ts");
      }

      return tool;
    }),
  );

  const toolMap = new Map(
    tools.map((t) => [
      t.definition.name,
      { handler: t.execute, timeout: t.timeout ?? DEFAULT_TIMEOUT },
    ]),
  );

  return {
    toolDefinitions: tools.map((t) => t.definition),
    async executeTool(name, input) {
      const entry = toolMap.get(name);
      if (!entry) {
        return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
      try {
        return await Promise.race([
          entry.handler(input),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Tool "${name}" timed out after ${entry.timeout / 1000}s`)),
              entry.timeout,
            ),
          ),
        ]);
      } catch (e) {
        return JSON.stringify({ error: errorMessage(e) });
      }
    },
  };
}
