import { NextResponse } from "next/server";

import { getWorkspaceGoHighLevelKey } from "@/lib/integrations/gohighlevel";
import { createAdminClient } from "@/lib/supabase/admin";

type ContactRow = {
  email: string | null;
  full_name: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  phone_e164: string;
  workspace_id: string;
};

type IntegrationRow = {
  config: Record<string, unknown>;
  workspace_id: string;
};

type HighLevelContactResponse = {
  contact?: {
    id?: string;
  };
  id?: string;
  [key: string]: unknown;
};

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");

  return Boolean(
    cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret),
  );
}

function configString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function splitName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "WhatsApp", lastName: "Lead" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function metadataTags(metadata: Record<string, unknown> | null) {
  const tags = metadata?.ai_tags;

  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
    : [];
}

async function upsertHighLevelContact({
  apiKey,
  contact,
  locationId,
}: {
  apiKey: string;
  contact: ContactRow;
  locationId: string;
}) {
  const { firstName, lastName } = splitName(contact.full_name);
  const apiBase = process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com";
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/contacts/upsert`, {
    body: JSON.stringify({
      email: contact.email ?? undefined,
      firstName,
      lastName,
      locationId,
      phone: contact.phone_e164,
      source: "WhatsApp SaaS",
      tags: ["whatsapp", "ia", ...metadataTags(contact.metadata)],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    method: "POST",
  });
  const payload = (await response.json()) as HighLevelContactResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "HighLevel rechazo el upsert.");
  }

  return {
    contactId: payload.contact?.id ?? payload.id ?? null,
    payload,
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: integrations, error: integrationsError } = await supabase
    .from("integrations")
    .select("workspace_id, config")
    .eq("provider", "gohighlevel")
    .eq("status", "active");

  if (integrationsError) {
    return NextResponse.json({ error: integrationsError.message }, { status: 500 });
  }

  const results = [];

  for (const integration of (integrations ?? []) as IntegrationRow[]) {
    const locationId = configString(integration.config ?? {}, "location_id");
    const apiKey = await getWorkspaceGoHighLevelKey(integration.workspace_id);

    if (!locationId) {
      results.push({
        status: "missing_location_id",
        workspaceId: integration.workspace_id,
      });
      continue;
    }

    if (!apiKey) {
      results.push({
        status: "missing_api_key",
        workspaceId: integration.workspace_id,
      });
      continue;
    }

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, workspace_id, full_name, phone_e164, email, metadata")
      .eq("workspace_id", integration.workspace_id)
      .order("updated_at", { ascending: false })
      .limit(25);

    if (contactsError) {
      results.push({
        error: contactsError.message,
        status: "contacts_error",
        workspaceId: integration.workspace_id,
      });
      continue;
    }

    for (const contact of (contacts ?? []) as ContactRow[]) {
      const currentMetadata = contact.metadata ?? {};

      try {
        const highLevel = await upsertHighLevelContact({
          apiKey,
          contact,
          locationId,
        });

        await supabase
          .from("contacts")
          .update({
            metadata: {
              ...currentMetadata,
              ghl_contact_id: highLevel.contactId,
              ghl_last_error: null,
              ghl_synced_at: new Date().toISOString(),
            },
          })
          .eq("id", contact.id)
          .eq("workspace_id", contact.workspace_id);

        results.push({
          contactId: contact.id,
          ghlContactId: highLevel.contactId,
          status: "synced",
          workspaceId: contact.workspace_id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido.";

        await supabase
          .from("contacts")
          .update({
            metadata: {
              ...currentMetadata,
              ghl_last_error: message,
              ghl_sync_failed_at: new Date().toISOString(),
            },
          })
          .eq("id", contact.id)
          .eq("workspace_id", contact.workspace_id);

        results.push({
          contactId: contact.id,
          error: message,
          status: "failed",
          workspaceId: contact.workspace_id,
        });
      }
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}
