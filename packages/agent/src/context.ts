import { readFile, writeFile } from "fs/promises";
import type Anthropic from "@anthropic-ai/sdk";

type MessageParam = Anthropic.Messages.MessageParam;

const CONTEXT_FILE = "context.txt";

export async function loadContext(): Promise<MessageParam[]> {
  let data: string;
  try {
    data = await readFile(CONTEXT_FILE, "utf-8");
  } catch {
    return [];
  }

  try {
    return JSON.parse(data) as MessageParam[];
  } catch (e) {
    console.warn(`Warning: context file ${CONTEXT_FILE} contains invalid JSON, starting fresh.`);
    return [];
  }
}

export async function saveContext(messages: MessageParam[]): Promise<void> {
  await writeFile(CONTEXT_FILE, JSON.stringify(messages, null, 2));
}
