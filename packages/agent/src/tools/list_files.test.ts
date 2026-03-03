import { describe, it, expect } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import tool from "./list_files";

const { definition, execute } = tool;

describe("list_files", () => {
  it("has a valid definition", () => {
    expect(definition.input_schema.required).toContain("path");
  });

  it("lists files in a directory", async () => {
    const dir = join(tmpdir(), `list_files_test_${Date.now()}`);
    await mkdir(dir);
    await writeFile(join(dir, "a.txt"), "");
    await writeFile(join(dir, "b.txt"), "");
    try {
      const result = JSON.parse(await execute({ path: dir }) as string);
      expect(result.files).toContain("a.txt");
      expect(result.files).toContain("b.txt");
      expect(result.files).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns error for non-existent directory", async () => {
    const result = JSON.parse(await execute({ path: "/tmp/does_not_exist_dir_12345" }) as string);
    expect(result.error).toBeDefined();
  });
});
