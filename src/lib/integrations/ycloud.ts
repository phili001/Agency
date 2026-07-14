import "server-only";

import { getIntegrationSecret } from "./secrets";

export async function getWorkspaceYCloudKey(workspaceId: string) {
  const workspaceKey = await getIntegrationSecret({
    kind: "api_key",
    provider: "ycloud",
    workspaceId,
  });

  return workspaceKey ?? process.env.YCLOUD_API_KEY ?? null;
}
