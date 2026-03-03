import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { defineTool, errorMessage } from "../tools";

export default defineTool({
  description:
    "Write content to a file at the given path. Creates the file if it doesn't exist, overwrites if it does.",
  params: {
    path: { type: "string", description: "The file path to write to" },
    content: { type: "string", description: "The content to write" },
  },
  required: ["path", "content"],
  async execute({ path, content }) {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf-8");
      return JSON.stringify({ path, status: "ok" });
    } catch (e) {
      return JSON.stringify({ path, error: errorMessage(e) });
    }
  },
});
