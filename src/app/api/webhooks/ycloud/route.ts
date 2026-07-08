import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type WebhookPayload = Record<string, unknown>;

type NormalizedYCloudEvent = {
  eventType: string;
  externalId: string | null;
  fromPhone: string | null;
  messageText: string | null;
  phoneId: string | null;
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
      ["message", "id"],
      ["data", "id"],
      ["data", "message", "id"],
      ["data", "whatsappInboundMessage", "id"],
    ]),
    fromPhone: normalizePhone(
      readPath(payload, [
        ["from"],
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
      ["message", "phoneId"],
      ["data", "phoneId"],
      ["data", "phone_id"],
      ["data", "message", "phoneId"],
      ["data", "whatsappInboundMessage", "phoneId"],
    ]),
  };
}

function isAuthorized(request: Request) {
  const expectedSecret = process.env.YCLOUD_WEBHOOK_SECRET;
  const receivedSecret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-ycloud-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  return Boolean(expectedSecret && receivedSecret && receivedSecret === expectedSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Webhook no autorizado." }, { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const event = normalizeEvent(payload);
  const supabase = createAdminClient();

  const { data: integration } = event.phoneId
    ? await supabase
        .from("integrations")
        .select("id, workspace_id")
        .eq("provider", "ycloud")
        .contains("config", { phone_id: event.phoneId })
        .maybeSingle()
    : { data: null };

  const workspaceId = integration?.workspace_id ?? null;
  let status: "stored" | "ignored" | "error" = "ignored";
  let errorMessage: string | null = null;

  try {
    if (workspaceId && event.fromPhone && event.messageText) {
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .upsert(
          {
            metadata: { source: "ycloud" },
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
              status: "open",
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

  return NextResponse.json({
    eventType: event.eventType,
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
