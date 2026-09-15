import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessMetrics = {
  activeConversations: number;
  aiReplies: number;
  contactsWithAppointment: number;
  pendingHandoffs: number;
};

const WINDOW_DAYS = 7;

/**
 * Cifras que le importan al dueño del negocio, no al que opera el sistema:
 * cuánto se atendió, cuánto lo hizo la IA sola, qué está esperando a una
 * persona y cuántas citas salieron. Tokens y coste viven en Observabilidad.
 *
 * Todo son `count` con `head: true`: no baja filas, solo el número.
 */
export async function getBusinessMetrics(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<BusinessMetrics> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [conversations, replies, handoffs, appointments] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("last_message_at", since),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("direction", "outbound")
      .eq("role", "assistant")
      .gte("created_at", since),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending_handoff"),
    // La cita se guarda en el contacto (ghl_appointment_id) cuando la IA la crea.
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("metadata->>ghl_appointment_id", "is", null),
  ]);

  return {
    activeConversations: conversations.count ?? 0,
    aiReplies: replies.count ?? 0,
    contactsWithAppointment: appointments.count ?? 0,
    pendingHandoffs: handoffs.count ?? 0,
  };
}

export const BUSINESS_METRICS_WINDOW_DAYS = WINDOW_DAYS;
