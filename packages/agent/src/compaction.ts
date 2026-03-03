import Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./client";

type MessageParam = Anthropic.Messages.MessageParam;

export const SUMMARY_MARKER = "[Context summary]";

/**
 * Find the last user message that contains text (not tool results).
 */
function findLastTextUserMessage(messages: MessageParam[]): MessageParam | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    if (typeof msg.content === "string") return msg;
    const hasText = msg.content.some((b) => b.type === "text");
    if (hasText) return msg;
  }
  return undefined;
}

/**
 * Estimate token count from messages (rough: 1 token ≈ 4 chars).
 */
function estimateTokens(messages: MessageParam[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

/**
 * Trim messages to fit within a token budget by dropping oldest messages,
 * keeping the first message if it's a summary and the last few exchanges.
 */
function trimMessagesToFit(messages: MessageParam[], maxTokens: number): MessageParam[] {
  if (estimateTokens(messages) <= maxTokens) {
    return [...messages];
  }

  const firstMsg = messages[0];
  const hasExistingSummary =
    firstMsg?.role === "user" &&
    typeof firstMsg.content === "string" &&
    firstMsg.content.startsWith(SUMMARY_MARKER);

  const keepLast = Math.min(4, messages.length);
  const tail = messages.slice(-keepLast);

  if (hasExistingSummary) {
    const result = [firstMsg, ...tail];
    if (estimateTokens(result) <= maxTokens) {
      return result;
    }
    return tail;
  }

  for (let start = 1; start < messages.length - keepLast; start++) {
    const candidate = messages.slice(start);
    if (estimateTokens(candidate) <= maxTokens) {
      return candidate;
    }
  }

  return tail;
}

/**
 * Compact messages by summarizing the conversation history.
 * Replaces all messages with a summary + the last text user message.
 * Returns the output token count reported by the summarization call.
 */
export async function compactMessages(messages: MessageParam[]): Promise<number> {
  const client = getClient();
  const trimmed = trimMessagesToFit(messages, 150_000);

  const summaryResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You are a summarizer. Produce a concise summary of the conversation so far, " +
      "preserving key facts, decisions, tool outputs, and any state the assistant needs to continue. " +
      "Do NOT include greetings or filler.",
    messages: trimmed,
  });

  const summary = summaryResponse.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const lastUserMessage = findLastTextUserMessage(messages);

  messages.length = 0;
  messages.push({ role: "user", content: `${SUMMARY_MARKER}: ${summary}` });
  messages.push({ role: "assistant", content: "Understood, I have the context. Let me continue." });
  if (lastUserMessage) {
    messages.push(lastUserMessage);
  }

  return summaryResponse.usage.output_tokens;
}
