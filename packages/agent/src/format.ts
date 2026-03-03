export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
export const italic = (s: string) => `\x1b[3m${s}\x1b[0m`;
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
export const bgGray = (s: string) => `\x1b[48;5;236m${s}\x1b[0m`;

function formatMarkdownLine(line: string, inCodeBlock: boolean): string {
  if (line.trimStart().startsWith("```")) {
    if (!inCodeBlock) {
      const lang = line.trimStart().slice(3).trim();
      return dim(`── ${lang || "code"} ──`);
    } else {
      return dim("──────");
    }
  }

  if (inCodeBlock) {
    return bgGray(`  ${line}`);
  }

  let formatted = line;

  const headingMatch = formatted.match(/^#{1,3}\s+(.*)/);
  if (headingMatch) {
    return bold(yellow(headingMatch[1]));
  }

  if (/^---+$/.test(formatted.trim())) {
    return dim("────────────────────");
  }

  formatted = formatted.replace(/`([^`]+)`/g, (_, code) => bgGray(` ${code} `));
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, (_, t) => bold(t));
  formatted = formatted.replace(/\*([^*]+)\*/g, (_, t) => italic(t));
  formatted = formatted.replace(/^(\s*)[-*]\s/, "$1• ");

  return formatted;
}

export function formatMarkdown(text: string): string {
  const lines = text.split("\n");
  let inCodeBlock = false;
  const out: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      out.push(formatMarkdownLine(line, inCodeBlock));
      inCodeBlock = !inCodeBlock;
    } else {
      out.push(formatMarkdownLine(line, inCodeBlock));
    }
  }
  return out.join("\n");
}

/**
 * Creates a streaming markdown formatter that buffers text by line,
 * formats each completed line, and writes it to stdout.
 */
export function createStreamingFormatter(): {
  push: (delta: string) => void;
  flush: () => void;
} {
  let buffer = "";
  let inCodeBlock = false;
  let firstLine = true;

  function emitLine(line: string) {
    if (!firstLine) {
      process.stdout.write("\n");
    }
    firstLine = false;

    if (line.trimStart().startsWith("```")) {
      process.stdout.write(formatMarkdownLine(line, inCodeBlock));
      inCodeBlock = !inCodeBlock;
    } else {
      process.stdout.write(formatMarkdownLine(line, inCodeBlock));
    }
  }

  return {
    push(delta: string) {
      buffer += delta;
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        emitLine(line);
      }
    },
    flush() {
      if (buffer) {
        emitLine(buffer);
        buffer = "";
      }
    },
  };
}
