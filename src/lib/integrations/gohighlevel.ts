import "server-only";

import { getIntegrationSecret } from "./secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FlowGhlAction } from "@/lib/flow-definitions";
import type { Json } from "@/lib/supabase/database.types";

export async function getWorkspaceGoHighLevelKey(workspaceId: string) {
  return getIntegrationSecret({
    kind: "api_key",
    provider: "gohighlevel",
    workspaceId,
  });
}

type ContactRow = {
  email: string | null;
  full_name: string | null;
  id: string;
  metadata: Json;
  phone_e164: string;
  workspace_id: string;
};

function configString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getConfigRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function splitName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "WhatsApp",
    lastName: parts.slice(1).join(" ") || "Lead",
  };
}

async function ghlFetch<T>({
  apiKey,
  body,
  method,
  path,
}: {
  apiKey: string;
  body?: Record<string, unknown>;
  method: "DELETE" | "POST" | "PUT";
  path: string;
}) {
  const apiBase = process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com";
  const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    method,
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "GoHighLevel rechazo la accion.");
  }

  return payload;
}

export async function runGoHighLevelFlowActions({
  actions,
  answers,
  contact,
  workspaceId,
}: {
  actions: FlowGhlAction[];
  answers?: Record<string, Json>;
  contact: ContactRow;
  workspaceId: string;
}) {
  if (actions.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const [{ data: integration }, apiKey] = await Promise.all([
    admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gohighlevel")
      .eq("status", "active")
      .maybeSingle(),
    getWorkspaceGoHighLevelKey(workspaceId),
  ]);

  if (!integration || !apiKey) {
    throw new Error("GoHighLevel no esta activo para este workspace.");
  }

  const config = getConfigRecord(integration.config);
  const locationId = configString(config, "location_id");

  if (!locationId) {
    throw new Error("Falta Location ID de GoHighLevel.");
  }

  const currentMetadata = getConfigRecord(contact.metadata);
  const { firstName, lastName } = splitName(contact.full_name);
  const contactPayload = await ghlFetch<{
    contact?: { id?: string };
    id?: string;
  }>({
    apiKey,
    body: {
      email: contact.email ?? undefined,
      firstName,
      lastName,
      locationId,
      phone: contact.phone_e164,
      source: "LEVY Flow",
    },
    method: "POST",
    path: "/contacts/upsert",
  });
  const ghlContactId =
    contactPayload.contact?.id ??
    contactPayload.id ??
    (typeof currentMetadata.ghl_contact_id === "string"
      ? currentMetadata.ghl_contact_id
      : null);

  if (!ghlContactId) {
    throw new Error("GoHighLevel no devolvio contact id.");
  }

  const results: Array<Record<string, unknown>> = [];
  let opportunityId =
    typeof currentMetadata.ghl_opportunity_id === "string"
      ? currentMetadata.ghl_opportunity_id
      : null;

  for (const action of actions) {
    const renderValue = (value?: string) =>
      (value ?? "").replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
        String(answers?.[key] ?? ""),
      );

    if (action.type === "add_tag") {
      await ghlFetch({
        apiKey,
        body: { tags: [action.tag] },
        method: "POST",
        path: `/contacts/${ghlContactId}/tags`,
      });
      results.push({ action: action.type, tag: action.tag });
    }

    if (action.type === "remove_tag") {
      await ghlFetch({
        apiKey,
        body: { tags: [action.tag] },
        method: "DELETE",
        path: `/contacts/${ghlContactId}/tags`,
      });
      results.push({ action: action.type, tag: action.tag });
    }

    if (action.type === "update_contact_field") {
      await ghlFetch({
        apiKey,
        body: {
          customFields: [
            {
              id: action.customFieldKey,
               value: renderValue(action.customFieldValue),
            },
          ],
        },
        method: "PUT",
        path: `/contacts/${ghlContactId}`,
      });
      results.push({ action: action.type, field: action.customFieldKey });
    }

    if (action.type === "upsert_opportunity") {
      const pipelineId =
        action.pipelineId ||
        configString(config, "default_pipeline_id") ||
        configString(config, "pipeline_id");
      const stageId =
        action.stageId ||
        configString(config, "default_stage_id") ||
        configString(config, "stage_id");

      if (!pipelineId || !stageId) {
        throw new Error("Falta pipelineId o stageId para mover oportunidad en GHL.");
      }

      const payload = await ghlFetch<{
        opportunity?: { id?: string };
        id?: string;
      }>({
        apiKey,
        body: {
          contactId: ghlContactId,
          locationId,
          name: `${contact.full_name ?? contact.phone_e164} - LEVY`,
          pipelineId,
          pipelineStageId: stageId,
          status: "open",
        },
        method: "POST",
        path: "/opportunities/upsert",
      });
      opportunityId = payload.opportunity?.id ?? payload.id ?? opportunityId;
      results.push({ action: action.type, opportunityId, pipelineId, stageId });
    }

    if (action.type === "create_task") {
      await ghlFetch({
        apiKey,
        body: {
          assignedTo: undefined,
          body: action.taskTitle,
          completed: false,
          contactId: ghlContactId,
          title: action.taskTitle,
        },
        method: "POST",
        path: `/contacts/${ghlContactId}/tasks`,
      });
      results.push({ action: action.type, title: action.taskTitle });
    }
  }

  await admin
    .from("contacts")
    .update({
      metadata: {
        ...currentMetadata,
        ghl_contact_id: ghlContactId,
        ghl_flow_synced_at: new Date().toISOString(),
        ...(opportunityId ? { ghl_opportunity_id: opportunityId } : {}),
      },
    })
    .eq("id", contact.id)
    .eq("workspace_id", workspaceId);

  return results;
}
