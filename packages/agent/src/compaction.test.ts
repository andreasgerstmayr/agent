import { describe, it, expect, vi } from "vitest";

// Mock the client before importing compaction
vi.mock("./client.js", () => ({
  MODEL: "test-model",
  getClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Summary of conversation." }],
        usage: { output_tokens: 50 },
      }),
    },
  }),
}));

const { compactMessages } = await import("./compaction.js");

describe("compactMessages", () => {
  it("replaces messages with a summary and last user message", async () => {
    const messages = [
      { role: "user" as const, content: "What is 2+2?" },
      { role: "assistant" as const, content: "4" },
      { role: "user" as const, content: "And 3+3?" },
      { role: "assistant" as const, content: "6" },
    ];

    const tokens = await compactMessages(messages);
    expect(tokens).toBe(50);

    // Messages should be replaced: summary, ack, last user message
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("[Context summary]");
    expect(messages[0].content).toContain("Summary of conversation.");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("user");
    expect(messages[2].content).toBe("And 3+3?");
  });

  it("handles messages with no text user message", async () => {
    const toolResultContent = [
      { type: "tool_result" as const, tool_use_id: "1", content: "result" },
    ];
    const messages = [
      { role: "user" as const, content: toolResultContent as any },
      { role: "assistant" as const, content: "done" },
    ];

    await compactMessages(messages);

    // Should have summary + ack, but no last user text message to preserve
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("[Context summary]");
  });
});
