import "server-only";

import { after } from "next/server";

import type { CalendarRequestMessage } from "@/lib/calendar-request";
import { parseCalendarTools } from "@/lib/calendar-tools";
import { createAdminClient } from "@/lib/supabase/admin";

import { type AgendaCalendarRuntime, buildAgendaRuntime, runAgendaTool } from "./agent-agenda";
import { googleBusyProvider, syncAppointment } from "./google-sync";

/**
 * Calendario del agente de WhatsApp: con qué agendas trabaja este agente y con
 * este contacto (`buildCalendarRuntime`) y qué hace cada tool
 * (`runCalendarTool`). La lógica vive en `agent-agenda.ts`.
 */

/** Llamada a una tool tal como la devuelve la API de Responses. */
export type CalendarToolCall = { arguments?: string; name?: string };

export type CalendarRuntime = AgendaCalendarRuntime;

export type CalendarRuntimeResult =
  | { reason: null; runtime: CalendarRuntime }
  | { reason: string; runtime: null };

export async function buildCalendarRuntime({
  agentName,
  contactId,
  conversationId,
  enabledToolIds,
  isBookingAgent,
  workspaceId,
}: {
  agentName: string;
  contactId: string;
  conversationId: string | null;
  enabledToolIds: string[];
  isBookingAgent: boolean;
  workspaceId: string;
}): Promise<CalendarRuntimeResult> {
  // Solo el agente de citas agenda. El setter y el de soporte no deben tocar
  // el calendario aunque el workspace tenga agenda.
  if (!isBookingAgent) {
    return {
      reason: `El agente "${agentName}" no esta identificado como agente de citas. Solo un agente de citas usa el calendario.`,
      runtime: null,
    };
  }

  const admin = createAdminClient();
  const [{ data: contact }, { data: toolAssets }] = await Promise.all([
    admin
      .from("contacts")
      .select("id, full_name, phone_e164, metadata")
      .eq("id", contactId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    admin
      .from("workspace_assets")
      .select("id, title, content, metadata")
      .eq("workspace_id", workspaceId)
      .eq("kind", "tool")
      .neq("status", "archived"),
  ]);
  const tools = parseCalendarTools(toolAssets ?? []);

  if (!contact?.phone_e164) {
    return { reason: "El contacto no tiene teléfono guardado.", runtime: null };
  }

  return buildAgendaRuntime(
    admin,
    {
      agentName,
      contact: { fullName: contact.full_name, id: contact.id, metadata: contact.metadata, phone: contact.phone_e164 },
      conversationId,
      enabledToolIds,
      tools,
      workspaceId,
    },
  );
}

export async function runCalendarTool(
  runtime: CalendarRuntime,
  call: CalendarToolCall,
  messages: CalendarRequestMessage[],
): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  return runAgendaTool(admin, runtime, call, messages, {
    externalBusy: googleBusyProvider(admin, runtime.workspaceId),
    // La copia a Google no hace esperar al cliente: va después de responder
    // (y si falla, la barrida de crm-jobs la reintenta).
    onAppointmentChanged: (appointmentId) =>
      after(() =>
        syncAppointment(admin, runtime.workspaceId, appointmentId).then(
          () => undefined,
          (error) => console.warn("[agent-tools:google-sync]", appointmentId, error instanceof Error ? error.message : error),
        ),
      ),
  });
}
