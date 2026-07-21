import { NextResponse } from "next/server";

import { normalizeAppUrl } from "@/lib/app-url";
import { startWebhookFlow } from "@/lib/flow-engine";
import { hashSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

type GhlWebhookPayload = {
  companyCode?: string;
  email?: string;
  event?: string;
  firstName?: string;
  flowKey?: string;
  ghlContactId?: string;
  lastName?: string;
  messageBody?: string;
  messageKey?: string;
  phone?: string;
};

function normalizePhone(value?: string | null) {
  const clean = value?.trim();

  if (!clean) {
    return null;
  }

  if (clean.startsWith("+")) {
    return clean;
  }

  const digits = clean.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice("bearer ".length).trim()
    : null;
}

async function runDelivery(request: Request, workspaceId: string, conversationId: string) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return;
  }

  const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin);
  const params = new URLSearchParams({
    conversationId,
    secret: cronSecret,
    workspaceId,
  });

  await fetch(`${baseUrl}/api/cron/deliver?${params.toString()}`, {
    cache: "no-store",
    method: "POST",
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as GhlWebhookPayload;
  const companyCode = payload.companyCode?.trim().toUpperCase();
  const phone = normalizePhone(payload.phone);
  const token = bearerToken(request);

  if (!companyCode || !phone) {
    return NextResponse.json(
      { error: "companyCode y phone son requeridos." },
      { status: 400 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Falta Authorization: Bearer." },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, company_code")
    .eq("company_code", companyCode)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("config")
    .eq("workspace_id", workspace.id)
    .eq("provider", "gohighlevel")
    .eq("status", "active")
    .maybeSingle();
  const config =
    integration?.config && typeof integration.config === "object" && !Array.isArray(integration.config)
      ? (integration.config as Record<string, unknown>)
      : {};
  const expectedHash =
    typeof config.ghl_webhook_secret_hash === "string"
      ? config.ghl_webhook_secret_hash
      : null;

  if (!expectedHash || hashSecret(token) !== expectedHash) {
    return NextResponse.json(
      { error: "Webhook GHL no autorizado para esta empresa." },
      { status: 401 },
    );
  }

  const fullName = [payload.firstName, payload.lastName]
    .filter((item) => item?.trim())
    .join(" ")
    .trim();
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id, metadata, automation_labels, messaging_status")
    .eq("workspace_id", workspace.id)
    .eq("phone_e164", phone)
    .maybeSingle();
  const existingMetadata =
    existingContact?.metadata &&
    typeof existingContact.metadata === "object" &&
    !Array.isArray(existingContact.metadata)
      ? (existingContact.metadata as Record<string, unknown>)
      : {};
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        email: payload.email ?? null,
        full_name: fullName || phone,
        metadata: {
          ...existingMetadata,
          ghl_contact_id: payload.ghlContactId ?? existingMetadata.ghl_contact_id,
          source: existingMetadata.source ?? "gohighlevel",
        },
        automation_labels:
          existingContact?.automation_labels ?? ["onboarding_excluded_existing"],
        messaging_status: existingContact?.messaging_status ?? "active",
        phone_e164: phone,
        workspace_id: workspace.id,
      },
      { onConflict: "workspace_id,phone_e164" },
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    return NextResponse.json(
      { error: contactError?.message ?? "No se pudo crear el contacto." },
      { status: 500 },
    );
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("contact_id", contact.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const conversationId =
    existingConversation?.id ??
    (
      await supabase
        .from("conversations")
        .insert({
          ai_enabled: false,
          contact_id: contact.id,
          status: "pending_handoff",
          workspace_id: workspace.id,
        })
        .select("id")
        .single()
    ).data?.id;

  if (!conversationId) {
    return NextResponse.json(
      { error: "No se pudo crear la conversacion." },
      { status: 500 },
    );
  }

  if (payload.messageBody && (existingContact?.messaging_status ?? "active") === "blocked") {
    return NextResponse.json(
      { error: "Toda atencion esta bloqueada para este contacto." },
      { status: 423 },
    );
  }

  if (payload.messageBody) {
    await supabase.from("messages").insert({
      body: payload.messageBody,
      contact_id: contact.id,
      conversation_id: conversationId,
      direction: "outbound",
      message_type: "text",
      metadata: {
        event: payload.event,
        ghl_contact_id: payload.ghlContactId,
        kind: "ghl_webhook_message",
        message_key: payload.messageKey,
      },
      role: "assistant",
      status: "queued",
      workspace_id: workspace.id,
    });
    await runDelivery(request, workspace.id, conversationId);

    return NextResponse.json({ conversationId, status: "queued" });
  }

  const flowKey = payload.flowKey ?? payload.messageKey;

  if (!flowKey) {
    return NextResponse.json(
      { error: "flowKey, messageKey o messageBody requerido." },
      { status: 400 },
    );
  }

  const result = await startWebhookFlow({
    contactId: contact.id,
    conversationId,
    flowKey,
    supabase,
    workspaceId: workspace.id,
  });

  await runDelivery(request, workspace.id, conversationId);

  return NextResponse.json({
    conversationId,
    flowKey,
    result,
    status: result.handled ? "flow_started" : "flow_not_found",
  });
}
