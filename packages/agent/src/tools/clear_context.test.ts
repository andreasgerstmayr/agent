import { describe, it, expect } from "vitest";
import tool from "./clear_context";

describe("clear_context", () => {
  it("returns context_cleared status", () => {
    const result = JSON.parse(tool.execute({}) as string);
    expect(result.status).toBe("context_cleared");
  });
});
