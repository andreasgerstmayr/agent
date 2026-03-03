import { defineTool, errorMessage } from "../tools";

export default defineTool({
  description: "Fetch the text content of a URL via HTTP(S). Returns the raw HTML or text body.",
  params: {
    url: { type: "string", description: "The URL to fetch" },
  },
  required: ["url"],
  async execute({ url }) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const plainText = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return JSON.stringify({ status: response.status, text: plainText.substring(0, 10000) });
    } catch (e) {
      return JSON.stringify({ error: errorMessage(e) });
    }
  },
});
