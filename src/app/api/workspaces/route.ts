import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireUser, requireWorkspaceRole } from "@/lib/authz";
import {
  type DefaultConversationMode,
  withDefaultConversationMode,
} from "@/lib/conversation-default";
import {
  getOnboardingChecklist,
  isChecklistComplete,
  setActiveWorkspaceId,
} from "@/lib/workspaces";
import { createAdminClient } from "@/lib/supabase/admin";

function asStateRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Mezcla campos sobre workspaces.onboarding_state sin pisar lo demas. */
async function patchOnboardingState(
  workspaceId: string,
  patch: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("onboarding_state")
    .eq("id", workspaceId)
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  const current = asStateRecord(workspace.onboarding_state);
  const { error } = await admin
    .from("workspaces")
    .update({ onboarding_state: { ...current, ...patch } })
    .eq("id", workspaceId);

  if (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { action, defaultConversationMode, workspaceId } = (await request.json()) as {
      action?:
        | "complete_onboarding"
        | "confirm_agents"
        | "select"
        | "set_default_conversation_mode"
        | "skip_onboarding";
      defaultConversationMode?: DefaultConversationMode;
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
          { checklist, error: "Todavía faltan pasos obligatorios." },
          { status: 400 },
        );
      }

      const admin = createAdminClient();
      const { data: workspace } = await admin
        .from("workspaces")
        .select("onboarding_state")
        .eq("id", workspaceId)
        .single();
      const { error } = await admin
        .from("workspaces")
        .update({
          onboarding_completed_at: new Date().toISOString(),
          onboarding_state: {
            ...(workspace?.onboarding_state &&
            typeof workspace.onboarding_state === "object" &&
            !Array.isArray(workspace.onboarding_state)
              ? workspace.onboarding_state
              : {}),
            ...checklist,
          },
        })
        .eq("id", workspaceId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ checklist, ok: true });
    }

    if (action === "set_default_conversation_mode") {
      if (!workspaceId || !["ai", "handoff"].includes(defaultConversationMode ?? "")) {
        return NextResponse.json(
          { error: "workspaceId y modo válido son requeridos." },
          { status: 400 },
        );
      }

      await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
      const admin = createAdminClient();
      const { data: workspace, error: workspaceError } = await admin
        .from("workspaces")
        .select("onboarding_state")
        .eq("id", workspaceId)
        .single();

      if (workspaceError) {
        throw workspaceError;
      }

      const { error } = await admin
        .from("workspaces")
        .update({
          onboarding_state: withDefaultConversationMode(
            workspace.onboarding_state,
            defaultConversationMode as DefaultConversationMode,
          ),
        })
        .eq("id", workspaceId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ defaultConversationMode, ok: true });
    }

    if (action === "confirm_agents" || action === "skip_onboarding") {
      if (!workspaceId) {
        return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
      }

      await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
      const field =
        action === "confirm_agents" ? "agents_confirmed_at" : "wizard_skipped_at";
      await patchOnboardingState(workspaceId, { [field]: new Date().toISOString() });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error, "workspaces");
  }
}
