import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type WebhookPayload = Record<string, unknown>;

type NormalizedYCloudEvent = {
  businessPhone: string | null;
  contactEmail: string | null;
  contactName: string | null;
  eventType: string;
  externalId: string | null;
  fromPhone: string | null;
  messageText: string | null;
  phoneId: string | null;
  wabaId: string | null;
};

function readPath(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current = value;

    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (current !== undefined && current !== null && current !== "") {
      return String(current);
    }
  }

  return null;
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

function normalizeEvent(payload: WebhookPayload): NormalizedYCloudEvent {
  return {
    businessPhone: normalizePhone(
      readPath(payload, [
        ["to"],
        ["phone"],
        ["phoneNumber"],
        ["businessPhone"],
        ["whatsappInboundMessage", "to"],
        ["message", "to"],
        ["data", "to"],
        ["data", "phone"],
        ["data", "phoneNumber"],
        ["data", "businessPhone"],
        ["data", "message", "to"],
        ["data", "whatsappInboundMessage", "to"],
      ]),
    ),
    contactEmail: readPath(payload, [
      ["contact", "email"],
      ["customer", "email"],
      ["customerProfile", "email"],
      ["whatsappInboundMessage", "customerProfile", "email"],
      ["message", "customerProfile", "email"],
      ["data", "contact", "email"],
      ["data", "customer", "email"],
      ["data", "customerProfile", "email"],
      ["data", "message", "customerProfile", "email"],
      ["data", "whatsappInboundMessage", "customerProfile", "email"],
    ]),
    contactName: readPath(payload, [
      ["fromName"],
      ["profileName"],
      ["contact", "name"],
      ["contact", "displayName"],
      ["customer", "name"],
      ["customerProfile", "name"],
      ["contacts", "0", "profile", "name"],
      ["whatsappInboundMessage", "fromName"],
      ["whatsappInboundMessage", "profileName"],
      ["whatsappInboundMessage", "customerProfile", "name"],
      ["message", "fromName"],
      ["message", "profileName"],
      ["message", "customerProfile", "name"],
      ["data", "fromName"],
      ["data", "profileName"],
      ["data", "contact", "name"],
      ["data", "contact", "displayName"],
      ["data", "customer", "name"],
      ["data", "customerProfile", "name"],
      ["data", "contacts", "0", "profile", "name"],
      ["data", "message", "fromName"],
      ["data", "message", "profileName"],
      ["data", "message", "customerProfile", "name"],
      ["data", "whatsappInboundMessage", "fromName"],
      ["data", "whatsappInboundMessage", "profileName"],
      ["data", "whatsappInboundMessage", "customerProfile", "name"],
    ]),
    eventType:
      readPath(payload, [
        ["type"],
        ["event"],
        ["event_type"],
        ["data", "type"],
        ["data", "event"],
      ]) ?? "ycloud.webhook",
    externalId: readPath(payload, [
      ["id"],
      ["messageId"],
      ["whatsappInboundMessage", "id"],
      ["message", "id"],
      ["data", "id"],
      ["data", "message", "id"],
      ["data", "whatsappInboundMessage", "id"],
    ]),
    fromPhone: normalizePhone(
      readPath(payload, [
        ["from"],
        ["whatsappInboundMessage", "from"],
        ["message", "from"],
        ["data", "from"],
        ["data", "message", "from"],
        ["data", "whatsappInboundMessage", "from"],
        ["data", "whatsappInboundMessage", "customerProfile", "whatsapp"],
      ]),
    ),
    messageText: readPath(payload, [
      ["text"],
      ["text", "body"],
      ["whatsappInboundMessage", "text", "body"],
      ["message", "text"],
      ["message", "text", "body"],
      ["data", "text"],
      ["data", "text", "body"],
      ["data", "message", "text"],
      ["data", "message", "text", "body"],
      ["data", "whatsappInboundMessage", "text", "body"],
    ]),
    phoneId: readPath(payload, [
      ["phoneId"],
      ["phone_id"],
      ["whatsappInboundMessage", "phoneId"],
      ["message", "phoneId"],
      ["data", "phoneId"],
      ["data", "phone_id"],
      ["data", "message", "phoneId"],
      ["data", "whatsappInboundMessage", "phoneId"],
    ]),
    wabaId: readPath(payload, [
      ["wabaId"],
      ["waba_id"],
      ["whatsappBusinessAccountId"],
      ["whatsappInboundMessage", "wabaId"],
      ["whatsappInboundMessage", "waba_id"],
      ["data", "wabaId"],
      ["data", "waba_id"],
      ["data", "whatsappBusinessAccountId"],
      ["data", "whatsappInboundMessage", "wabaId"],
      ["data", "whatsappInboundMessage", "waba_id"],
    ]),
  };
}

function getMetadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isAuthorized(request: Request) {
  const expectedSecret = process.env.YCLOUD_WEBHOOK_SECRET;
  const receivedSecret = getReceivedSecret(request);

  return Boolean(expectedSecret && receivedSecret && receivedSecret === expectedSecret);
}

function getReceivedSecret(request: Request) {
  return (
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-ycloud-webhook-secret") ??
    new URL(request.url).searchParams.get("secret")
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[ycloud:webhook] unauthorized", {
      hasExpectedSecret: Boolean(process.env.YCLOUD_WEBHOOK_SECRET),
      hasReceivedSecret: Boolean(getReceivedSecret(request)),
    });

    return NextResponse.json({ error: "Webhook no autorizado." }, { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const event = normalizeEvent(payload);
  const supabase = createAdminClient();

  const { data: integrations } = await supabase
    .from("integrations")
    .select("id, workspace_id, config")
    .eq("provider", "ycloud");
  const matchedIntegration =
    integrations?.find((item) => {
      const config =
        item.config && typeof item.config === "object" && !Array.isArray(item.config)
          ? (item.config as Record<string, unknown>)
          : {};
      const configPhone = normalizePhone(String(config.phone_e164 ?? ""));

      return (
        (event.phoneId && config.phone_id === event.phoneId) ||
        (event.wabaId && config.waba_id === event.wabaId) ||
        (event.businessPhone && configPhone === event.businessPhone)
      );
    }) ?? null;
  const integration =
    matchedIntegration ?? (integrations?.length === 1 ? integrations[0] : null);
  const matchedBy = matchedIntegration
    ? "identifier"
    : integrations?.length === 1
      ? "single_integration_fallback"
      : null;

  const workspaceId = integration?.workspace_id ?? null;
  let status: "stored" | "ignored" | "error" = "ignored";
  let errorMessage: string | null = null;

  try {
    if (workspaceId && event.fromPhone && event.messageText) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, full_name, email, metadata")
        .eq("workspace_id", workspaceId)
        .eq("phone_e164", event.fromPhone)
        .maybeSingle();
      const existingMetadata = getMetadataRecord(existingContact?.metadata);
      const ycloudMetadata = getMetadataRecord(existingMetadata.ycloud);
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .upsert(
          {
            email: event.contactEmail ?? existingContact?.email ?? null,
            full_name: event.contactName ?? existingContact?.full_name ?? null,
            metadata: {
              ...existingMetadata,
              source: existingMetadata.source ?? "ycloud",
              ycloud: {
                ...ycloudMetadata,
                business_phone: event.businessPhone ?? ycloudMetadata.business_phone,
                contact_email: event.contactEmail ?? ycloudMetadata.contact_email,
                contact_name: event.contactName ?? ycloudMetadata.contact_name,
                external_id: event.externalId,
                last_event_type: event.eventType,
                phone_id: event.phoneId ?? ycloudMetadata.phone_id,
                raw_from: event.fromPhone,
                updated_at: new Date().toISOString(),
                waba_id: event.wabaId ?? ycloudMetadata.waba_id,
              },
            },
            phone_e164: event.fromPhone,
            workspace_id: workspaceId,
          },
          { onConflict: "workspace_id,phone_e164" },
        )
        .select("id")
        .single();

      if (contactError) {
        throw contactError;
      }

      const { data: existingConversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("workspace_id", workspaceId)
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
              contact_id: contact.id,
              external_conversation_id: event.externalId,
              last_message_at: new Date().toISOString(),
              ai_enabled: false,
              status: "pending_handoff",
              workspace_id: workspaceId,
            })
            .select("id")
            .single()
        ).data?.id;

      if (!conversationId) {
        throw new Error("No se pudo crear la conversacion.");
      }

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          body: event.messageText,
          contact_id: contact.id,
          conversation_id: conversationId,
          direction: "inbound",
          message_type: "text",
          metadata: { raw_event_type: event.eventType },
          provider_message_id: event.externalId,
          role: "user",
          status: "stored",
          workspace_id: workspaceId,
        })
        .select("id, created_at")
        .single();

      if (messageError) {
        throw messageError;
      }

      await supabase
        .from("conversations")
        .update({ last_message_at: message.created_at })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId);

      status = "stored";
    }
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Error desconocido.";
  }

  await supabase.from("webhook_events").insert({
    error: errorMessage,
    event_type: event.eventType,
    external_id: event.externalId,
    payload,
    provider: "ycloud",
    status,
    workspace_id: workspaceId,
  });

  console.info("[ycloud:webhook] processed", {
    eventType: event.eventType,
    hasBusinessPhone: Boolean(event.businessPhone),
    hasFromPhone: Boolean(event.fromPhone),
    hasMessageText: Boolean(event.messageText),
    hasPhoneId: Boolean(event.phoneId),
    hasWabaId: Boolean(event.wabaId),
    matchedBy,
    status,
    workspaceId,
  });

  return NextResponse.json({
    eventType: event.eventType,
    matchedBy,
    status,
    workspaceId,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "ycloud",
  });
}
