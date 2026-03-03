import { describe, it, expect } from "vitest";
import { defineTool, loadTools } from "./tools";

describe("loadTools", () => {
  it("loads all tool definitions", async () => {
    const { toolDefinitions } = await loadTools();
    const names = toolDefinitions.map((t) => t.name);
    expect(names).toContain("browser");
    expect(names).toContain("fetch_url");
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("list_files");
  });

  it("each definition has required fields", async () => {
    const { toolDefinitions } = await loadTools();
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTypeOf("string");
      expect(tool.description).toBeTypeOf("string");
      expect(tool.input_schema).toBeDefined();
    }
  });

  it("executeTool runs a known tool", async () => {
    const { executeTool } = await loadTools();
    const result = JSON.parse(await executeTool("list_files", { path: "." }) as string);
    expect(result.files).toBeDefined();
  });

  it("executeTool returns error for unknown tool", async () => {
    const { executeTool } = await loadTools();
    const result = JSON.parse(await executeTool("nonexistent", {}) as string);
    expect(result.error).toContain("Unknown tool");
  });
});

describe("defineTool", () => {
  it("creates a tool definition from config", () => {
    const tool = defineTool({
      name: "test_tool",
      description: "A test tool",
      params: {
        name: { type: "string", description: "Name param" },
      },
      required: ["name"],
      execute: (input) => JSON.stringify({ hello: input.name }),
    });

    expect(tool.definition.name).toBe("test_tool");
    expect(tool.definition.description).toBe("A test tool");
    expect(tool.definition.input_schema.properties).toHaveProperty("name");
    expect(tool.definition.input_schema.required).toEqual(["name"]);
  });

  it("uses __unnamed__ when name is omitted", () => {
    const tool = defineTool({
      description: "Unnamed tool",
      execute: () => "result",
    });

    expect(tool.definition.name).toBe("__unnamed__");
  });

  it("execute function works correctly", () => {
    const tool = defineTool({
      description: "Add numbers",
      params: {
        x: { type: "number", description: "First number" },
        y: { type: "number", description: "Second number" },
      },
      required: ["x", "y"],
      execute: ({ x, y }) => JSON.stringify({ sum: x + y }),
    });

    const result = JSON.parse(tool.execute({ x: 3, y: 4 }) as string);
    expect(result.sum).toBe(7);
  });

  it("preserves timeout setting", () => {
    const tool = defineTool({
      description: "Slow tool",
      timeout: 60_000,
      execute: () => "done",
    });

    expect(tool.timeout).toBe(60_000);
  });

  it("timeout is undefined when not specified", () => {
    const tool = defineTool({
      description: "Normal tool",
      execute: () => "done",
    });

    expect(tool.timeout).toBeUndefined();
  });

  it("omits required when not provided", () => {
    const tool = defineTool({
      description: "No required",
      params: {
        optional: { type: "string", description: "Optional param" },
      },
      execute: () => "done",
    });

    expect(tool.definition.input_schema.required).toBeUndefined();
  });
});
