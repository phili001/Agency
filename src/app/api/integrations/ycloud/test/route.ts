import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { getWorkspaceYCloudKey } from "@/lib/integrations/ycloud";

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

    if (!response.ok) {
      return NextResponse.json(
        { error: "YCloud rechazo la API key o el endpoint de numeros." },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
