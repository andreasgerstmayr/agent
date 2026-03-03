import { describe, it, expect } from "vitest";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import tool from "./write_file";

const { definition, execute } = tool;

describe("write_file", () => {
  it("has a valid definition", () => {
    expect(definition.input_schema.required).toContain("path");
    expect(definition.input_schema.required).toContain("content");
  });

  it("writes a new file", async () => {
    const path = join(tmpdir(), `write_file_test_${Date.now()}.txt`);
    try {
      const result = JSON.parse(await execute({ path, content: "test content" }) as string);
      expect(result.status).toBe("ok");
      const content = await readFile(path, "utf-8");
      expect(content).toBe("test content");
    } finally {
      await rm(path, { force: true });
    }
  });

  it("creates parent directories", async () => {
    const dir = join(tmpdir(), `write_file_test_${Date.now()}`);
    const path = join(dir, "nested", "file.txt");
    try {
      const result = JSON.parse(await execute({ path, content: "nested" }) as string);
      expect(result.status).toBe("ok");
      const content = await readFile(path, "utf-8");
      expect(content).toBe("nested");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
