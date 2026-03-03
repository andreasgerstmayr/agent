import * as readline from "readline/promises";
import { chat, ConfirmToolFn, ConfirmResult } from "./agent";
import { loadContext, saveContext } from "./context";
import {
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  formatMarkdown,
  createStreamingFormatter,
} from "./format";
import type Anthropic from "@anthropic-ai/sdk";

type MessageParam = Anthropic.Messages.MessageParam;

function getMessageText(msg: MessageParam): string | undefined {
  if (typeof msg.content === "string") return msg.content;
  const block = msg.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text : undefined;
}

function printRestoredContext(messages: MessageParam[]) {
  console.log(dim(`Restored ${messages.length} messages from context.\n`));
  const recent = messages.filter((m) => getMessageText(m)).slice(-6);
  for (const msg of recent) {
    const text = getMessageText(msg)!;
    const preview = text.length > 200 ? text.slice(0, 200) + "…" : text;
    if (msg.role === "user") {
      console.log(`  ${bold(green("You:"))} ${dim(preview)}`);
    } else {
      console.log(`  ${bold(cyan("Assistant:"))} ${dim(formatMarkdown(preview))}`);
    }
  }
  console.log();
}

function createConfirmTool(rl: readline.Interface): ConfirmToolFn {
  return async (toolName, _input): Promise<ConfirmResult> => {
    const answer = await rl.question(
      `  ${yellow("Allow")} ${bold(toolName)}? ${dim("[Y/n/c(ancel)]")} `
    );
    const a = answer.trim().toLowerCase();
    if (a === "c" || a === "cancel") return "cancel";
    if (a === "n") return "no";
    return "yes";
  };
}

async function handleTurn(
  rl: readline.Interface,
  messages: MessageParam[]
): Promise<void> {
  const input = await rl.question(`${bold(green("You:"))} `);
  const trimmed = input.trim();
  if (!trimmed) return;

  messages.push({ role: "user", content: trimmed });

  try {
    let headerPrinted = false;
    const fmt = createStreamingFormatter();
    const onText = (delta: string) => {
      if (!headerPrinted) {
        process.stdout.write(`\n${bold(cyan("Assistant:"))} `);
        headerPrinted = true;
      }
      fmt.push(delta);
    };
    await chat(messages, { confirmTool: createConfirmTool(rl), onText });
    if (headerPrinted) {
      fmt.flush();
      process.stdout.write("\n\n");
    }
  } catch (error) {
    console.error(`\n${red("Error:")} ${error instanceof Error ? error.message : error}\n`);
  }

  await saveContext(messages);
}

export async function loop(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages = await loadContext();
  if (messages.length > 0) {
    printRestoredContext(messages);
  }
  console.log(
    `${bold("Assistant (Vertex AI)")} — type your message, Ctrl+C to exit.\n`
  );

  while (true) {
    await handleTurn(rl, messages);
  }
}
