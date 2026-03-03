import { describe, it, expect } from "vitest";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import tool from "./read_file";

const { definition, execute } = tool;

describe("read_file", () => {
  it("has a valid definition", () => {
    expect(definition.input_schema.required).toContain("path");
  });

  it("reads an existing file", async () => {
    const path = join(tmpdir(), `read_file_test_${Date.now()}.txt`);
    await writeFile(path, "hello world", "utf-8");
    try {
      const result = JSON.parse(await execute({ path }) as string);
      expect(result.content).toBe("hello world");
      expect(result.path).toBe(path);
    } finally {
      await unlink(path);
    }
  });

  it("returns error for non-existent file", async () => {
    const result = JSON.parse(await execute({ path: "/tmp/does_not_exist_12345.txt" }) as string);
    expect(result.error).toBeDefined();
  });
});
