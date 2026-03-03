import { readdir } from "fs/promises";
import { defineTool, errorMessage } from "../tools";

export default defineTool({
  description: "List files in a directory.",
  params: {
    path: { type: "string", description: "The directory path to list" },
  },
  required: ["path"],
  async execute({ path }) {
    try {
      const files = await readdir(path);
      return JSON.stringify({ path, files });
    } catch (e) {
      return JSON.stringify({ path, error: errorMessage(e) });
    }
  },
});
