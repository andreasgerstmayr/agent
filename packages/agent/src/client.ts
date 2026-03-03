import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";

export const MODEL = "claude-opus-4-6";

function createClient(): AnthropicVertex {
  const region = process.env.CLOUD_ML_REGION ?? "us-east5";
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new Error("ANTHROPIC_VERTEX_PROJECT_ID environment variable is required.");
  }
  return new AnthropicVertex({ region, projectId });
}

let _client: AnthropicVertex | undefined;
export function getClient(): AnthropicVertex {
  if (!_client) {
    _client = createClient();
  }
  return _client;
}
