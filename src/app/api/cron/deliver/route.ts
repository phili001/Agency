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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, workspace_id, conversation_id, contact_id, body, metadata")
    .eq("direction", "outbound")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

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
          .select("phone_e164")
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

      const ycloudResult = await sendYCloudText({
        apiKey,
        body: message.body,
        from,
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
