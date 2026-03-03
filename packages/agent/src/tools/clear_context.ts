import { defineTool } from "../tools";

export default defineTool({
  description:
    "Clear the conversation context. Use this when the user asks to reset, clear, or start fresh.",
  execute: () => JSON.stringify({ status: "context_cleared" }),
});
