import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

function stableTime(value: string | null) {
  if (!value) {
    return "Nueva";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nueva";
  }

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}

function getMetadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent", "viewer"]);

    const admin = createAdminClient();
    const [{ data: workspace }, { data: conversations }] = await Promise.all([
      admin.from("workspaces").select("id, name").eq("id", workspaceId).single(),
      admin
        .from("conversations")
        .select("id, contact_id, status, ai_enabled, last_message_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100),
    ]);
    const contactIds = [...new Set((conversations ?? []).map((item) => item.contact_id))];
    const conversationIds = (conversations ?? []).map((item) => item.id);
    const [{ data: contacts }, { data: messages }] = await Promise.all([
      contactIds.length
        ? admin
            .from("contacts")
            .select("id, full_name, phone_e164, email, metadata, created_at")
            .eq("workspace_id", workspaceId)
            .in("id", contactIds)
        : Promise.resolve({ data: [] }),
      conversationIds.length
        ? admin
            .from("messages")
            .select("id, conversation_id, body, direction, role, message_type, created_at")
            .eq("workspace_id", workspaceId)
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: true })
            .limit(2000)
        : Promise.resolve({ data: [] }),
    ]);
    const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]));

    return NextResponse.json({
      conversations: (conversations ?? []).map((conversation) => {
        const contact = contactById.get(conversation.contact_id);
        const metadata = getMetadataRecord(contact?.metadata);

        return {
          aiEnabled: conversation.ai_enabled,
          business: workspace?.name ?? "Workspace",
          contactId: conversation.contact_id,
          contactMetadata: metadata,
          contactPhone: contact?.phone_e164,
          id: conversation.id,
          name: contact?.full_name ?? contact?.phone_e164 ?? "Contacto",
          rawStatus: conversation.status,
          status: conversation.ai_enabled ? "IA activa" : "Handoff",
          summary:
            conversation.status === "pending_handoff"
              ? "Conversacion esperando atencion humana."
              : "Conversacion sincronizada desde WhatsApp.",
          time: stableTime(conversation.last_message_at ?? conversation.created_at),
          workspaceId,
        };
      }),
      messages: messages ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
