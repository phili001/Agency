import { NextResponse } from "next/server";

import { getWorkspaceYCloudKey } from "@/lib/integrations/ycloud";
import { createAdminClient } from "@/lib/supabase/admin";

type QueuedMessage = {
  body: string | null;
  contact_id: string | null;
  conversation_id: string;
  id: string;
  metadata: Record<string, unknown> | null;
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

type InteractiveOption = {
  id: string;
  title: string;
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

function getInteractiveOptions(metadata: Record<string, unknown> | null) {
  const options = metadata?.flow_options;

  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .filter(
      (option): option is InteractiveOption =>
        Boolean(option) &&
        typeof option === "object" &&
        typeof (option as Record<string, unknown>).id === "string" &&
        typeof (option as Record<string, unknown>).title === "string",
    )
    .slice(0, 10)
    .map((option) => ({
      id: option.id.slice(0, 200),
      title: option.title.slice(0, 24),
    }));
}

async function sendYCloudMessage({
  apiKey,
  body,
  from,
  options,
  to,
}: {
  apiKey: string;
  body: string;
  from: string;
  options: InteractiveOption[];
  to: string;
}) {
  const apiBase = process.env.YCLOUD_API_BASE ?? "https://api.ycloud.com/v2";
  const messagePayload: Record<string, unknown> = {
    from,
    text: { body },
    to,
    type: "text",
  };

  if (options.length > 0) {
    messagePayload.type = "interactive";
    delete messagePayload.text;
    messagePayload.interactive =
      options.length <= 3
        ? {
            action: {
              buttons: options.map((option) => ({
                reply: { id: option.id, title: option.title },
                type: "reply",
              })),
            },
            body: { text: body },
            type: "button",
          }
        : {
            action: {
              button: "Ver opciones",
              sections: [
                {
                  rows: options.map((option) => ({
                    id: option.id,
                    title: option.title,
                  })),
                  title: "Opciones",
                },
              ],
            },
            body: { text: body },
            type: "list",
          };
  }

  const response = await fetch(`${apiBase.replace(/\/$/, "")}/whatsapp/messages/sendDirectly`, {
    body: JSON.stringify(messagePayload),
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const params = new URL(request.url).searchParams;
  const conversationId = params.get("conversationId");
  const workspaceId = params.get("workspaceId");
  let messagesQuery = supabase
    .from("messages")
    .select("id, workspace_id, conversation_id, contact_id, body, metadata")
    .eq("direction", "outbound")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

  if (conversationId) {
    messagesQuery = messagesQuery.eq("conversation_id", conversationId);
  }

  if (workspaceId) {
    messagesQuery = messagesQuery.eq("workspace_id", workspaceId);
  }

  const { data: messages, error } = await messagesQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const message of (messages ?? []) as QueuedMessage[]) {
    try {
      if (!message.body || !message.contact_id) {
        throw new Error("Mensaje sin body o contact_id.");
      }

      const [{ data: contact }, { data: integration }] = await Promise.all([
        supabase
          .from("contacts")
          .select("phone_e164, messaging_status")
          .eq("id", message.contact_id)
          .eq("workspace_id", message.workspace_id)
          .single(),
        supabase
          .from("integrations")
          .select("config")
          .eq("workspace_id", message.workspace_id)
          .eq("provider", "ycloud")
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (!contact) {
        throw new Error("Contacto no encontrado.");
      }

      if (contact.messaging_status === "blocked") {
        await supabase
          .from("messages")
          .update({
            metadata: {
              ...(message.metadata ?? {}),
              delivery_error: "Contacto bloqueado por respuestas invalidas.",
            },
            status: "failed",
          })
          .eq("id", message.id)
          .eq("workspace_id", message.workspace_id);
        continue;
      }

      if (!integration) {
        throw new Error("YCloud no esta activo para este workspace.");
      }

      const config = (integration as IntegrationRow).config ?? {};
      const apiKey = await getWorkspaceYCloudKey(message.workspace_id);
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

      const ycloudResult = await sendYCloudMessage({
        apiKey,
        body: message.body,
        from,
        options: getInteractiveOptions(message.metadata),
        to: (contact as ContactRow).phone_e164,
      });
      const providerMessageId =
        ycloudResult.id ?? ycloudResult.messageId ?? String(crypto.randomUUID());

      await supabase
        .from("messages")
        .update({
          metadata: {
            ...(message.metadata ?? {}),
            delivery: "ycloud",
            ycloud_response: ycloudResult,
          },
          provider_message_id: providerMessageId,
          status: "sent",
        })
        .eq("id", message.id)
        .eq("workspace_id", message.workspace_id);

      results.push({ messageId: message.id, status: "sent" });
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error ? sendError.message : "Error desconocido.";

      await supabase
        .from("messages")
        .update({
          metadata: {
            ...(message.metadata ?? {}),
            delivery_error: errorMessage,
          },
          status: "failed",
        })
        .eq("id", message.id)
        .eq("workspace_id", message.workspace_id);

      results.push({
        error: errorMessage,
        messageId: message.id,
        status: "failed",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}
