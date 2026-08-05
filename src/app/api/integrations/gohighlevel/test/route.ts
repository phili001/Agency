import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { getWorkspaceGoHighLevelKey } from "@/lib/integrations/gohighlevel";
import { createAdminClient } from "@/lib/supabase/admin";

type GhlErrorPayload = {
  contacts?: unknown[];
  message?: string | string[];
};

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as GhlErrorPayload;
  }

  const text = await response.text();
  return { message: text.slice(0, 300) };
}

function errorMessage(payload: GhlErrorPayload, status: number) {
  const message = Array.isArray(payload.message)
    ? payload.message.join(" ")
    : payload.message;

  if (status === 401) {
    return message ?? "GoHighLevel rechazo la API key. Revisala en Settings > API Keys.";
  }

  if (status === 404) {
    return message ?? "GoHighLevel no encontro ese Location ID.";
  }

  return message ?? `GoHighLevel rechazo la prueba. HTTP ${status}.`;
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent"]);
    const apiKey = await getWorkspaceGoHighLevelKey(workspaceId);

    if (!apiKey) {
      return NextResponse.json({ error: "Conecta GoHighLevel primero." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: integration } = await admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gohighlevel")
      .maybeSingle();
    const config =
      integration?.config &&
      typeof integration.config === "object" &&
      !Array.isArray(integration.config)
        ? (integration.config as Record<string, unknown>)
        : {};
    const locationId =
      typeof config.location_id === "string" ? config.location_id.trim() : "";

    if (!locationId) {
      return NextResponse.json(
        { error: "Falta el Location ID de GoHighLevel." },
        { status: 400 },
      );
    }

    // Lectura pura: valida API key y Location ID juntos sin crear nada en el CRM.
    const apiBase = process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com";
    const query = new URLSearchParams({ limit: "1", locationId });
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/contacts/?${query}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
      },
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: errorMessage(payload, response.status) },
        { status: response.status },
      );
    }

    return NextResponse.json({ locationId, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
