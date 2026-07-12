import "server-only";

import { getIntegrationSecret } from "./secrets";

export async function getWorkspaceGoHighLevelKey(workspaceId: string) {
  return getIntegrationSecret({
    kind: "api_key",
    provider: "gohighlevel",
    workspaceId,
  });
}
