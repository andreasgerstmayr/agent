# AI Agent

A self-improving AI agent framework powered by Claude, built with TypeScript. The agent runs as an interactive CLI, autonomously calling tools and managing conversation context. It can read, modify, and extend its own source code and tools at runtime.

## Features

- **Interactive CLI** with streaming responses and markdown rendering
- **Tool framework** with hot-reloading — add or modify tools without restarting
- **Context persistence** across sessions (saved to `context.txt`)
- **Automatic context compaction** when token usage gets high
- **Browser automation** via Playwright
- **Self-modification** — the agent can create and update its own tools

## Prerequisites

- Node.js
- A Google Cloud project with Vertex AI enabled

## Setup

```bash
# Set required environment variable
export ANTHROPIC_VERTEX_PROJECT_ID=your-project-id

# Optionally set region (defaults to us-east5)
export CLOUD_ML_REGION=us-east5

# Install dependencies
npm install
```

## Usage

```bash
# Start the agent
npm run start -w agent

# Run tests
npm test -w agent
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents (up to 100KB) |
| `write_file` | Create or overwrite files |
| `list_files` | List directory contents |
| `browser` | Browser automation (navigate, click, type, screenshot) |
| `fetch_url` | HTTP fetch with HTML-to-text conversion |
| `weather` | Weather lookups via Open-Meteo |
| `time` | Get current date and time |
| `clear_context` | Clear conversation history |

### Adding Custom Tools

Create a new `.ts` file in `packages/agent/src/tools/` using the `defineTool()` helper. The tool will be hot-reloaded automatically.
