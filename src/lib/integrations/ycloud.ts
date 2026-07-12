import "server-only";

import { getIntegrationSecret } from "./secrets";

export async function getWorkspaceYCloudKey(workspaceId: string) {
  return getIntegrationSecret({
    kind: "api_key",
    provider: "ycloud",
    workspaceId,
  });
}
