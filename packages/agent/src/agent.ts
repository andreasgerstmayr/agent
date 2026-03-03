import Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./client";
import { compactMessages } from "./compaction";
import { dim, yellow } from "./format";
import { loadTools, srcDir, toolsDir, ToolResultContent, errorMessage } from "./tools";

type MessageParam = Anthropic.Messages.MessageParam;

const COMPACTION_THRESHOLD = 50_000;
const MAX_TOOL_RESULT_CHARS = 20_000;
const SYSTEM_PROMPT = `
You are a self-improving AI agent built with TypeScript and the Anthropic Claude API. You can read and modify your own source code to improve yourself, fix bugs, or add capabilities.

## Your codebase
Your source code lives in: ${srcDir}

Core files:
- agent.ts    — chat loop, tool execution, streaming, system prompt (this file)
- tools.ts    — tool loader, defineTool() helper, timeout enforcement
- client.ts   — Vertex AI client setup
- compaction.ts — context summarization when token usage is high
- format.ts   — terminal markdown formatting
- context.ts  — conversation persistence (load/save)
- loop.ts     — interactive REPL
- index.ts    — entry point

## Tools
Your tools live as TypeScript files in: ${toolsDir}
Each tool file uses defineTool() and is a default export:

import { defineTool } from "../tools";

export default defineTool({
  description: "What the tool does",
  params: {
    param: { type: "string", description: "..." },
  },
  required: ["param"],
  execute({ param }) {
    return JSON.stringify({ result: "..." });
  },
});

Tools are hot-reloaded — new or modified tools are available immediately on your next turn.

When the user asks you to do something you lack a tool for, create the tool first, then use it.
Use list_files and read_file to inspect existing tools and core files before modifying them.

## Self-modification
You can modify any of your source files using the write_file tool. Use this when:
- You need a new tool or capability
- You spot a bug in your own code
- The user asks you to change your behavior or improve yourself
- You want to optimize your own performance

IMPORTANT: Before writing or modifying any of your own source files (tools or core), you MUST first describe the planned change to the user in plain language and ask for confirmation. Only proceed with the write_file call after the user approves. This applies to creating new tools, editing existing tools, and modifying core files.

Be careful when modifying core files (agent.ts, tools.ts, etc.) — read the file first, understand it, and make targeted changes. Changes to core files take effect on restart; tool changes take effect immediately.

## Guidelines
- When using the browser tool, do NOT include a screenshot step unless the user explicitly asks for one. Use get_text to extract information from pages instead.
- Always read a file before modifying it.
- Prefer small, focused changes over large rewrites.
`;

export type ConfirmResult = "yes" | "no" | "cancel";
export type ConfirmToolFn = (toolName: string, input: Record<string, unknown>) => Promise<ConfirmResult>;

export interface ChatOptions {
  confirmTool?: ConfirmToolFn;
  onText?: (delta: string) => void;
}

/**
 * Run an agent chat loop. Mutates the `messages` array in place
 * (including during compaction, where older messages are replaced with a summary).
 */
export async function chat(
  messages: MessageParam[],
  options: ChatOptions = {},
): Promise<string> {
  const { confirmTool, onText } = options;
  const client = getClient();
  let lastInputTokens = 0;

  while (true) {
    if (lastInputTokens > COMPACTION_THRESHOLD) {
      try {
        const summaryTokens = await compactMessages(messages);
        console.log(dim(`  ⟳ Context compacted: ${lastInputTokens} → ~${summaryTokens} tokens`));
      } catch (err) {
        console.log(dim(`  ⟳ Context compaction failed, continuing: ${errorMessage(err)}`));
      }
    }

    const { toolDefinitions, executeTool } = await loadTools();

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    if (onText) {
      stream.on("text", (text) => onText(text));
    }

    const response = await stream.finalMessage();

    lastInputTokens = response.usage.input_tokens;
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      return response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tool of toolUseBlocks) {
      const toolInput = (tool.input ?? {}) as Record<string, unknown>;
      console.log(`  ${yellow(`▶ ${tool.name}`)}${dim(`(${JSON.stringify(toolInput)})`)}`);

      if (confirmTool) {
        const decision = await confirmTool(tool.name, toolInput);
        if (decision === "cancel") {
          return "Cancelled by user.";
        }
        if (decision === "no") {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: JSON.stringify({ error: "Tool call denied by user." }),
          });
          continue;
        }
      }
      const result = await executeTool(tool.name, toolInput);
      if (tool.name === "clear_context") {
        messages.length = 0;
        lastInputTokens = 0;
        return "Context cleared.";
      }

      if (Array.isArray(result)) {
        const textParts = result
          .filter((b): b is Anthropic.Messages.TextBlockParam => b.type === "text")
          .map((b) => b.text)
          .join(" ");
        const imageCount = result.filter((b) => b.type === "image").length;
        const preview = textParts.length > 200 ? textParts.slice(0, 200) + "…" : textParts;
        console.log(dim(`  ↳ ${preview}${imageCount ? ` [+${imageCount} image(s)]` : ""}`));
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: result,
        });
      } else {
        const preview = result.length > 200 ? result.slice(0, 200) + "…" : result;
        console.log(dim(`  ↳ ${preview}`));
        const truncatedResult =
          result.length > MAX_TOOL_RESULT_CHARS
            ? result.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... (truncated)"
            : result;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: truncatedResult,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}
