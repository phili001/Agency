import { NextResponse } from "next/server";

import { getWorkspaceYCloudKey } from "@/lib/integrations/ycloud";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  contact_id: string | null;
  id: string;
  workspace_id: string;
};

type ContactRow = {
  phone_e164: string;
};

type IntegrationRow = {
  config: Record<string, unknown>;
};

type YCloudSendResult = {
  id?: string;
  messageId?: string;
  [key: string]: unknown;
};

function configString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function sendYCloudText({
  apiKey,
  body,
  from,
  to,
}: {
  apiKey: string;
  body: string;
  from: string;
  to: string;
}) {
  const apiBase = process.env.YCLOUD_API_BASE ?? "https://api.ycloud.com/v2";
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/whatsapp/messages/sendDirectly`, {
    body: JSON.stringify({
      from,
      text: {
        body,
      },
      to,
      type: "text",
    }),
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    method: "POST",
  });
  const payload = (await response.json()) as YCloudSendResult & {
    error?: { message?: string };
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? payload.message ?? "YCloud rechazo el envio.",
    );
  }

  return payload;
}

export async function POST(request: Request) {
  const { body, conversationId } = (await request.json()) as {
    body?: string;
    conversationId?: string;
  };
  const cleanBody = body?.trim();

  if (!conversationId || !cleanBody) {
    return NextResponse.json(
      { error: "conversationId y body son requeridos." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, workspace_id, contact_id")
    .eq("id", conversationId)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json(
      { error: conversationError?.message ?? "Conversacion no encontrada." },
      { status: 404 },
    );
  }

  const conversationRow = conversation as ConversationRow;

  if (!conversationRow.contact_id) {
    return NextResponse.json(
      { error: "La conversacion no tiene contacto asociado." },
      { status: 400 },
    );
  }

  const { data: contactStatus } = await supabase
    .from("contacts")
    .select("messaging_status")
    .eq("id", conversationRow.contact_id)
    .eq("workspace_id", conversationRow.workspace_id)
    .single();

  if (contactStatus?.messaging_status === "blocked") {
    return NextResponse.json(
      { error: "Toda atencion esta bloqueada para este contacto." },
      { status: 423 },
    );
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      body: cleanBody,
      contact_id: conversationRow.contact_id,
      conversation_id: conversationRow.id,
      direction: "outbound",
      message_type: "text",
      role: "human",
      status: "queued",
      workspace_id: conversationRow.workspace_id,
    })
    .select("id, conversation_id, body, direction, role, message_type, created_at")
    .single();

  if (messageError || !message) {
    return NextResponse.json(
      { error: messageError?.message ?? "No se pudo guardar el mensaje." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  try {
    const [{ data: contact }, { data: integration }] = await Promise.all([
      admin
        .from("contacts")
        .select("phone_e164")
        .eq("id", conversationRow.contact_id)
        .eq("workspace_id", conversationRow.workspace_id)
        .single(),
      admin
        .from("integrations")
        .select("config")
        .eq("workspace_id", conversationRow.workspace_id)
        .eq("provider", "ycloud")
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (!contact) {
      throw new Error("Contacto no encontrado.");
    }

    if (!integration) {
      throw new Error("YCloud no esta activo para este workspace.");
    }

    const config = (integration as IntegrationRow).config ?? {};
    const apiKey = await getWorkspaceYCloudKey(conversationRow.workspace_id);
    const from =
      configString(config, "phone_id") ??
      configString(config, "phone_e164") ??
      configString(config, "from");

    if (!apiKey) {
      throw new Error("YCloud no tiene API key guardada para este workspace.");
    }

    if (!from) {
      throw new Error("Falta phone_id o numero emisor en Integraciones > YCloud.");
    }

    const ycloudResult = await sendYCloudText({
      apiKey,
      body: cleanBody,
      from,
      to: (contact as ContactRow).phone_e164,
    });
    const providerMessageId =
      ycloudResult.id ?? ycloudResult.messageId ?? String(crypto.randomUUID());
    const providerWamid =
      typeof ycloudResult.wamid === "string"
        ? ycloudResult.wamid
        : typeof ycloudResult.whatsappMessageId === "string"
          ? ycloudResult.whatsappMessageId
          : null;

    await admin
      .from("messages")
      .update({
        metadata: {
          delivery: "ycloud",
          provider_wamid: providerWamid,
          ycloud_response: ycloudResult,
        },
        provider_message_id: providerMessageId,
        status: "sent",
      })
      .eq("id", message.id)
      .eq("workspace_id", conversationRow.workspace_id);

    await admin
      .from("conversations")
      .update({ last_message_at: message.created_at })
      .eq("id", conversationRow.id)
      .eq("workspace_id", conversationRow.workspace_id);

    return NextResponse.json({ message, status: "sent" });
  } catch (sendError) {
    const errorMessage =
      sendError instanceof Error ? sendError.message : "Error desconocido.";

    await admin
      .from("messages")
      .update({
        metadata: {
          delivery_error: errorMessage,
        },
        status: "failed",
      })
      .eq("id", message.id)
      .eq("workspace_id", conversationRow.workspace_id);

    return NextResponse.json(
      { error: errorMessage, message, status: "failed" },
      { status: 502 },
    );
  }
}
