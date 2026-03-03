import { chromium, BrowserContext, Page } from "playwright";
import { defineTool, errorMessage, ToolResultContent } from "../tools";

const GLOBAL_KEY = "__browser_tool_state__" as const;
const g = globalThis as {
  [GLOBAL_KEY]?: { context: BrowserContext; page: Page };
};

async function getPage(): Promise<Page> {
  const state = g[GLOBAL_KEY];
  if (state && !state.page.isClosed()) {
    return state.page;
  }
  if (state) {
    await state.context.browser()?.close();
  }
  let browser;
  try {
    browser = await chromium.connectOverCDP("http://localhost:9222");
  } catch {
    throw new Error(
      "Could not connect to Chrome. Please start Chrome with remote debugging enabled:\n\n" +
        "  chromium-browser --remote-debugging-port=9222",
    );
  }
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = context.pages()[0] ?? await context.newPage();
  g[GLOBAL_KEY] = { context, page };
  return page;
}

type Step =
  | { type: "navigate"; url: string }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string }
  | { type: "screenshot" }
  | { type: "get_text"; selector: string }
  | { type: "wait"; selector: string };

export default defineTool({
  description:
    "Control a browser to perform web automation. Accepts a sequence of steps executed in order. The browser persists across calls. Only take screenshots when the user explicitly asks for one — prefer using get_text to extract information.",
  params: {
    steps: {
      type: "array",
      description: "Array of action steps to execute in order.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["navigate", "click", "type", "screenshot", "get_text", "wait"],
            description: "The action type.",
          },
          url: {
            type: "string",
            description: "URL to navigate to (for navigate).",
          },
          selector: {
            type: "string",
            description: "CSS or Playwright selector (for click, type, get_text, wait).",
          },
          text: {
            type: "string",
            description: "Text to type (for type).",
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["steps"],
  timeout: 60_000,
  async execute({ steps: rawSteps }): Promise<string | ToolResultContent> {
    const steps = rawSteps as Step[];
    const textResults: Record<string, unknown>[] = [];
    const contentBlocks: ToolResultContent = [];

    try {
      const p = await getPage();

      for (const step of steps) {
        switch (step.type) {
          case "navigate":
            await p.goto(step.url);
            break;
          case "click":
            await p.click(step.selector);
            break;
          case "type":
            await p.fill(step.selector, step.text);
            break;
          case "screenshot": {
            const buffer = await p.screenshot({ type: "jpeg", quality: 50, scale: "css" });
            contentBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: buffer.toString("base64"),
              },
            });
            continue;
          }
          case "get_text": {
            const text = await p.textContent(step.selector);
            textResults.push({ text: text ?? "" });
            continue;
          }
          case "wait":
            await p.waitForSelector(step.selector);
            break;
          default:
            throw new Error(`Unknown step type: ${String((step as Record<string, unknown>).type)}`);
        }
        textResults.push({ status: "ok" });
      }
    } catch (e) {
      textResults.push({ error: errorMessage(e) });
    }

    if (contentBlocks.length > 0) {
      if (textResults.length > 0) {
        contentBlocks.unshift({
          type: "text",
          text: JSON.stringify({ results: textResults }),
        });
      }
      return contentBlocks;
    }

    return JSON.stringify({ results: textResults });
  },
});
