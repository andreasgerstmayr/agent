import { describe, it, expect } from "vitest";
// loop.ts exports are tested indirectly since loop() requires stdin interaction.
// We verify the module can be imported without errors.
import * as loopModule from "./loop";

describe("loop module", () => {
  it("exports a loop function", () => {
    expect(loopModule.loop).toBeTypeOf("function");
  });
});
