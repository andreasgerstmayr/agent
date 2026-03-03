import { defineTool } from "../tools";

export default defineTool({
  description: "Get the current local date and time.",
  execute: () => new Date().toString(),
});
