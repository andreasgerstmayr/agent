import { describe, it, expect } from "vitest";
import { formatMarkdown, createStreamingFormatter } from "./format";

// Strip ANSI escape codes for easier assertion
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("formatMarkdown", () => {
  it("returns plain text unchanged", () => {
    expect(strip(formatMarkdown("hello world"))).toBe("hello world");
  });

  it("formats headings", () => {
    expect(strip(formatMarkdown("## My Heading"))).toBe("My Heading");
  });

  it("formats inline code", () => {
    const result = strip(formatMarkdown("use `npm install` here"));
    expect(result).toContain("npm install");
  });

  it("formats bold text", () => {
    const result = strip(formatMarkdown("this is **bold** text"));
    expect(result).toContain("bold");
  });

  it("formats italic text", () => {
    const result = strip(formatMarkdown("this is *italic* text"));
    expect(result).toContain("italic");
  });

  it("formats bullet points", () => {
    const result = strip(formatMarkdown("- item one"));
    expect(result).toContain("• item one");
  });

  it("formats horizontal rules", () => {
    const result = strip(formatMarkdown("---"));
    expect(result).toContain("────");
  });

  it("formats code blocks", () => {
    const result = strip(formatMarkdown("```ts\nconst x = 1;\n```"));
    expect(result).toContain("ts");
    expect(result).toContain("const x = 1;");
  });

  it("handles multiline text", () => {
    const input = "# Title\n\nSome text\n\n- bullet";
    const result = strip(formatMarkdown(input));
    expect(result).toContain("Title");
    expect(result).toContain("Some text");
    expect(result).toContain("• bullet");
  });
});

describe("createStreamingFormatter", () => {
  it("buffers partial lines until newline", () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const fmt = createStreamingFormatter();
      fmt.push("hello");
      // No newline yet, so nothing emitted (line is buffered)
      expect(chunks).toHaveLength(0);

      fmt.push(" world\n");
      // Now the full line should be emitted
      expect(chunks.length).toBeGreaterThan(0);
      expect(strip(chunks.join(""))).toContain("hello world");
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it("flush emits remaining buffered content", () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const fmt = createStreamingFormatter();
      fmt.push("partial");
      expect(chunks).toHaveLength(0);

      fmt.flush();
      expect(chunks.length).toBeGreaterThan(0);
      expect(strip(chunks.join(""))).toContain("partial");
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it("handles multiple lines in a single push", () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const fmt = createStreamingFormatter();
      fmt.push("line1\nline2\nline3\n");
      const output = strip(chunks.join(""));
      expect(output).toContain("line1");
      expect(output).toContain("line2");
      expect(output).toContain("line3");
    } finally {
      process.stdout.write = origWrite;
    }
  });
});
