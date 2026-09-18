import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Postgres: unique_violation. */
const UNIQUE_VIOLATION = "23505";

type OpenConversation = { ai_enabled: boolean; id: string };

/**
 * Devuelve la conversación abierta del contacto, creándola si no existe.
 *
 * "Buscar y si no hay crear" tiene una carrera: dos avisos del mismo contacto
 * en el mismo segundo (el mensaje y su acuse, o un reintento) creaban dos
 * conversaciones y el inbox mostraba el chat duplicado. El índice único
 * `conversations_one_open_per_contact` hace que el segundo insert falle; aquí
 * se captura ese fallo y se devuelve la conversación que ganó.
 */
export async function findOrCreateOpenConversation(
  supabase: SupabaseClient,
  {
    aiEnabled,
    contactId,
    externalConversationId,
    workspaceId,
  }: {
    aiEnabled: boolean;
    contactId: string;
    externalConversationId?: string | null;
    workspaceId: string;
  },
): Promise<{ conversation: OpenConversation; created: boolean }> {
  const findOpen = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id, ai_enabled")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    return (data as OpenConversation | null) ?? null;
  };

  const existing = await findOpen();

  if (existing) {
    return { conversation: existing, created: false };
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      ai_enabled: aiEnabled,
      contact_id: contactId,
      external_conversation_id: externalConversationId ?? null,
      last_message_at: new Date().toISOString(),
      status: aiEnabled ? "open" : "pending_handoff",
      workspace_id: workspaceId,
    })
    .select("id, ai_enabled")
    .single();

  if (created) {
    return { conversation: created as OpenConversation, created: true };
  }

  if (error?.code === UNIQUE_VIOLATION) {
    const winner = await findOpen();

    if (winner) {
      return { conversation: winner, created: false };
    }
  }

  throw error ?? new Error("No se pudo crear la conversación.");
}
