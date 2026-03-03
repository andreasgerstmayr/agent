import { describe, it, expect } from "vitest";
import tool from "./time";

describe("time", () => {
  it("returns a date string", () => {
    const result = tool.execute({}) as string;
    // Should be parseable as a date
    expect(new Date(result).toString()).not.toBe("Invalid Date");
  });
});
