import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboardingChecklist } from "@/lib/workspaces";

/**
 * Lo consulta el paso "Prueba real" del wizard cada pocos segundos: devuelve el
 * checklist y el ultimo mensaje entrante y la ultima respuesta de la IA para
 * mostrarselos al usuario en cuanto llegan.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent", "viewer"]);
    const admin = createAdminClient();
    const [checklist, { data: inbound }, { data: reply }] = await Promise.all([
      getOnboardingChecklist(workspaceId),
      admin
        .from("messages")
        .select("id, body, created_at")
        .eq("workspace_id", workspaceId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("messages")
        .select("id, body, created_at")
        .eq("workspace_id", workspaceId)
        .eq("direction", "outbound")
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      checklist,
      lastInbound: inbound ?? null,
      lastReply: reply ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error, "onboarding/status");
  }
}
