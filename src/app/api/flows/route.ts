import { NextResponse } from "next/server";

import { defaultLevyFlowStages, defaultLevyFlowSteps } from "@/lib/flow-definitions";
import { requireWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

type FlowPayload = {
  action?: "create_levy_template" | "delete" | "save" | "toggle";
  description?: string;
  flowId?: string;
  name?: string;
  status?: "active" | "archived" | "draft" | "paused";
  steps?: unknown[];
  triggerConfig?: Record<string, unknown>;
  triggerType?: "first_inbound" | "keyword" | "manual" | "tag" | "webhook";
  workspaceId?: string;
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function excludeExistingContacts(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
) {
  const { data: contacts, error } = await admin
    .from("contacts")
    .select("id, automation_labels")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  await Promise.all(
    (contacts ?? []).map((contact) =>
      admin
        .from("contacts")
        .update({
          automation_labels: Array.from(
            new Set([
              ...stringArray(contact.automation_labels).filter(
                (label) => label !== "onboarding_eligible",
              ),
              "onboarding_excluded_existing",
            ]),
          ),
        })
        .eq("id", contact.id)
        .eq("workspace_id", workspaceId),
    ),
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as FlowPayload;
    const workspaceId = payload.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
    const admin = createAdminClient();

    if (payload.action === "create_levy_template") {
      const { data, error } = await admin
        .from("flows")
        .insert({
          description:
            "Formulario conversacional para reunir informacion y enviar al contacto a la agenda.",
          name: "LEVY - Diagnostico y agenda",
          status: "draft",
          steps: defaultLevyFlowSteps,
          trigger_config: {
            allowRepeat: false,
            audience: "new_contacts",
            excludedLabels: ["onboarding_excluded_existing"],
            requiredLabels: ["onboarding_eligible"],
            stages: defaultLevyFlowStages,
          },
          trigger_type: "first_inbound",
          workspace_id: workspaceId,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ flow: data });
    }

    if (payload.action === "delete") {
      if (!payload.flowId) {
        return NextResponse.json({ error: "flowId requerido." }, { status: 400 });
      }

      const { error } = await admin
        .from("flows")
        .update({ status: "archived" })
        .eq("id", payload.flowId)
        .eq("workspace_id", workspaceId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ status: "archived" });
    }

    if (payload.action === "toggle") {
      if (!payload.flowId || !payload.status) {
        return NextResponse.json(
          { error: "flowId y status son requeridos." },
          { status: 400 },
        );
      }

      const { data: existing } = await admin
        .from("flows")
        .select("status, trigger_config")
        .eq("id", payload.flowId)
        .eq("workspace_id", workspaceId)
        .single();
      let triggerConfig = (existing?.trigger_config ?? {}) as Record<string, unknown>;

      if (
        payload.status === "active" &&
        existing?.status !== "active" &&
        triggerConfig.audience === "new_contacts"
      ) {
        await excludeExistingContacts(admin, workspaceId);
        triggerConfig = {
          ...triggerConfig,
          activatedAt: new Date().toISOString(),
        };
      }

      const { data, error } = await admin
        .from("flows")
        .update({ status: payload.status, trigger_config: triggerConfig })
        .eq("id", payload.flowId)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ flow: data });
    }

    const cleanName = payload.name?.trim() || "Flujo sin nombre";
    const { data: existingFlow } = payload.flowId
      ? await admin
          .from("flows")
          .select("status")
          .eq("id", payload.flowId)
          .eq("workspace_id", workspaceId)
          .maybeSingle()
      : { data: null };
    let triggerConfig = payload.triggerConfig ?? {};

    if (
      payload.status === "active" &&
      existingFlow?.status !== "active" &&
      triggerConfig.audience === "new_contacts"
    ) {
      await excludeExistingContacts(admin, workspaceId);
      triggerConfig = {
        ...triggerConfig,
        activatedAt: new Date().toISOString(),
      };
    }

    const flowRecord = {
      description: payload.description?.trim() ?? "",
      name: cleanName,
      status: payload.status ?? "draft",
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      trigger_config: triggerConfig,
      trigger_type: payload.triggerType ?? "manual",
      workspace_id: workspaceId,
    };
    const query = payload.flowId
      ? admin
          .from("flows")
          .update(flowRecord)
          .eq("id", payload.flowId)
          .eq("workspace_id", workspaceId)
          .select("*")
          .single()
      : admin.from("flows").insert(flowRecord).select("*").single();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ flow: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
