import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { getWorkspaceYCloudKey } from "@/lib/integrations/ycloud";

type YCloudErrorPayload = {
  error?: { message?: string };
  message?: string;
};

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as YCloudErrorPayload;
  }

  const text = await response.text();
  return { message: text.slice(0, 300) };
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent"]);
    const apiKey = await getWorkspaceYCloudKey(workspaceId);

    if (!apiKey) {
      return NextResponse.json({ error: "Conecta YCloud primero." }, { status: 400 });
    }

    const apiBase = process.env.YCLOUD_API_BASE ?? "https://api.ycloud.com/v2";
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/whatsapp/numbers`, {
      headers: { "X-API-Key": apiKey },
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload.error?.message ??
            payload.message ??
            `YCloud rechazo la prueba. HTTP ${response.status}.`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true, sample: payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
