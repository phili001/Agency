import { NextResponse } from "next/server";

import { requireUser, requireWorkspaceRole } from "@/lib/authz";
import {
  getOnboardingChecklist,
  isChecklistComplete,
  setActiveWorkspaceId,
} from "@/lib/workspaces";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { action, workspaceId } = (await request.json()) as {
      action?: "complete_onboarding" | "select";
      workspaceId?: string;
    };

    await requireUser();

    if (action === "select") {
      if (!workspaceId) {
        return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
      }

      await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent", "viewer"]);
      await setActiveWorkspaceId(workspaceId);

      return NextResponse.json({ ok: true });
    }

    if (action === "complete_onboarding") {
      if (!workspaceId) {
        return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
      }

      await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
      const checklist = await getOnboardingChecklist(workspaceId);

      if (!isChecklistComplete(checklist)) {
        return NextResponse.json(
          { checklist, error: "Todavia faltan pasos obligatorios." },
          { status: 400 },
        );
      }

      const admin = createAdminClient();
      const { error } = await admin
        .from("workspaces")
        .update({
          onboarding_completed_at: new Date().toISOString(),
          onboarding_state: checklist,
        })
        .eq("id", workspaceId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ checklist, ok: true });
    }

    return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
