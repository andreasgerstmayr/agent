import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadContext, saveContext } from "./context";
import { unlink, readFile, rename } from "fs/promises";

const CONTEXT_FILE = "context.txt";
const CONTEXT_BACKUP = "context.txt.bak";

describe("context", () => {
  beforeEach(async () => {
    // Back up existing context file if present
    try {
      await rename(CONTEXT_FILE, CONTEXT_BACKUP);
    } catch {
      // no existing file
    }
  });

  afterEach(async () => {
    // Remove test file and restore backup
    try {
      await unlink(CONTEXT_FILE);
    } catch {
      // file may not exist
    }
    try {
      await rename(CONTEXT_BACKUP, CONTEXT_FILE);
    } catch {
      // no backup
    }
  });

  it("loadContext returns empty array when no file exists", async () => {
    const messages = await loadContext();
    expect(messages).toEqual([]);
  });

  it("saveContext writes messages and loadContext reads them back", async () => {
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi there" },
    ];
    await saveContext(messages);

    const raw = await readFile(CONTEXT_FILE, "utf-8");
    expect(JSON.parse(raw)).toEqual(messages);

    const loaded = await loadContext();
    expect(loaded).toEqual(messages);
  });

  it("saveContext overwrites existing context", async () => {
    await saveContext([{ role: "user" as const, content: "first" }]);
    await saveContext([{ role: "user" as const, content: "second" }]);

    const loaded = await loadContext();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe("second");
  });
});
