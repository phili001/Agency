import "server-only";

import { getIntegrationSecret } from "./secrets";

export async function getWorkspaceOpenAIKey(workspaceId: string) {
  const workspaceKey = await getIntegrationSecret({
    kind: "api_key",
    provider: "openai",
    workspaceId,
  });

  return workspaceKey ?? process.env.OPENAI_API_KEY ?? null;
}
