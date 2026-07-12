import "server-only";

import { getIntegrationSecret } from "./secrets";

export async function getWorkspaceOpenAIKey(workspaceId: string) {
  return getIntegrationSecret({
    kind: "api_key",
    provider: "openai",
    workspaceId,
  });
}
