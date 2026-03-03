import { readFile, stat } from "fs/promises";
import { defineTool, errorMessage } from "../tools";

const MAX_FILE_SIZE = 100 * 1024; // 100 KB

export default defineTool({
  description: "Read the contents of a file at the given path. Files larger than 100KB are truncated.",
  params: {
    path: { type: "string", description: "The file path to read" },
  },
  required: ["path"],
  async execute({ path }) {
    try {
      const info = await stat(path);
      const truncated = info.size > MAX_FILE_SIZE;
      const content = await readFile(path, "utf-8");
      const result = truncated ? content.slice(0, MAX_FILE_SIZE) : content;
      return JSON.stringify({
        path,
        content: result,
        ...(truncated ? { truncated: true, totalSize: info.size } : {}),
      });
    } catch (e) {
      return JSON.stringify({ path, error: errorMessage(e) });
    }
  },
});
