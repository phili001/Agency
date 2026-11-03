import type { Json } from "@/lib/supabase/database.types";

import { conflict, dbFailure, invalid, isUniqueViolation, notFound } from "../crm/errors.ts";
import { optionalText } from "../crm/normalize.ts";
import type { CrmClient } from "../crm/shared.ts";
import { type AgendaConfig, DEFAULT_WEEKLY_SCHEDULE, agendaConfigFromRow, validateAgendaSettings } from "./slots.ts";

/**
 * Agendas de una empresa. La `description` la lee el agente para elegir entre
 * varias («Consultas presenciales en Madrid», «Videollamadas»…); una de ellas
 * es la de por defecto (índice único parcial en la base).
 */
export type GoogleSyncMode = "off" | "push" | "push_and_busy";

export type AgendaRow = {
  active: boolean;
  closed_dates: string[];
  description: string;
  google_calendar_id: string | null;
  google_sync_mode: GoogleSyncMode;
  id: string;
  is_default: boolean;
  max_days_ahead: number;
  min_notice_minutes: number;
  name: string;
  no_show_enabled: boolean;
  no_show_hours_after: number;
  no_show_message: string | null;
  no_show_template: string | null;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_message: string | null;
  reminder_template: string | null;
  schedule: Json;
  services: Json;
  slot_step_minutes: number;
  timezone: string;
};

export type Agenda = AgendaRow & { config: AgendaConfig };

export const AGENDA_COLUMNS =
  "id, name, description, is_default, active, timezone, schedule, services, slot_step_minutes, min_notice_minutes, max_days_ahead, closed_dates, google_calendar_id, google_sync_mode, reminder_enabled, reminder_hours_before, reminder_message, reminder_template, no_show_enabled, no_show_hours_after, no_show_message, no_show_template";

const SYNC_MODES: GoogleSyncMode[] = ["off", "push", "push_and_busy"];

export function toAgenda(row: Record<string, unknown>): Agenda {
  const agenda = row as unknown as AgendaRow;
  return { ...agenda, closed_dates: agenda.closed_dates ?? [], config: agendaConfigFromRow(row) };
}

function intInRange(value: unknown, label: string, min: number, max: number) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw invalid(`${label} tiene que ser un número entero entre ${min} y ${max}.`);
  }

  return number;
}

export type AgendaInput = {
  active?: unknown;
  closedDates?: unknown;
  description?: unknown;
  googleCalendarId?: unknown;
  googleSyncMode?: unknown;
  maxDaysAhead?: unknown;
  minNoticeMinutes?: unknown;
  name?: unknown;
  noShowEnabled?: unknown;
  noShowHoursAfter?: unknown;
  noShowMessage?: unknown;
  noShowTemplate?: unknown;
  reminderEnabled?: unknown;
  reminderHoursBefore?: unknown;
  reminderMessage?: unknown;
  reminderTemplate?: unknown;
  schedule?: unknown;
  services?: unknown;
  slotStepMinutes?: unknown;
  timezone?: unknown;
};

/** Valida lo que manda el panel y devuelve las columnas a escribir. */
export function agendaChanges(input: AgendaInput) {
  const changes: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = optionalText(input.name, 81);
    if (!name || name.length > 80) {
      throw invalid("El nombre de la agenda tiene que tener entre 1 y 80 caracteres.");
    }
    changes.name = name;
  }
  if (input.description !== undefined) {
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length > 2000) {
      throw invalid("La descripción admite como máximo 2.000 caracteres.");
    }
    changes.description = description;
  }
  if (input.active !== undefined) {
    changes.active = input.active === true;
  }
  if (input.slotStepMinutes !== undefined) {
    changes.slot_step_minutes = intInRange(input.slotStepMinutes, "El intervalo entre huecos", 5, 240);
  }
  if (input.minNoticeMinutes !== undefined) {
    changes.min_notice_minutes = intInRange(input.minNoticeMinutes, "La antelación mínima", 0, 43200);
  }
  if (input.maxDaysAhead !== undefined) {
    changes.max_days_ahead = intInRange(input.maxDaysAhead, "El máximo de días", 1, 365);
  }
  if (input.googleSyncMode !== undefined) {
    if (!SYNC_MODES.includes(input.googleSyncMode as GoogleSyncMode)) {
      throw invalid("Modo de Google Calendar no válido.");
    }
    changes.google_sync_mode = input.googleSyncMode;
  }
  if (input.googleCalendarId !== undefined) {
    changes.google_calendar_id = optionalText(input.googleCalendarId, 300);
  }
  if (input.reminderEnabled !== undefined) {
    changes.reminder_enabled = input.reminderEnabled === true;
  }
  if (input.reminderHoursBefore !== undefined) {
    changes.reminder_hours_before = intInRange(input.reminderHoursBefore, "Las horas antes del recordatorio", 1, 72);
  }
  if (input.noShowEnabled !== undefined) {
    changes.no_show_enabled = input.noShowEnabled === true;
  }
  if (input.noShowHoursAfter !== undefined) {
    changes.no_show_hours_after = intInRange(input.noShowHoursAfter, "Las horas después de la inasistencia", 0, 72);
  }
  for (const [key, column, max] of [
    ["reminderMessage", "reminder_message", 1000],
    ["noShowMessage", "no_show_message", 1000],
    ["reminderTemplate", "reminder_template", 512],
    ["noShowTemplate", "no_show_template", 512],
  ] as const) {
    const value = input[key];
    if (value !== undefined) {
      const text = typeof value === "string" ? value.trim() : "";
      if (text.length > max) {
        throw invalid(`El texto admite como máximo ${max} caracteres.`);
      }
      changes[column] = text || null;
    }
  }

  const settings = validateAgendaSettings({
    closedDates: input.closedDates,
    schedule: input.schedule,
    services: input.services,
    timezone: input.timezone,
  });

  return { ...changes, ...settings };
}

export async function listAgendas(client: CrmClient, workspaceId: string, { activeOnly = false } = {}) {
  let query = client.from("agendas").select(AGENDA_COLUMNS).eq("workspace_id", workspaceId);

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    throw dbFailure("listAgendas", error);
  }

  return (data ?? []).map((row) => toAgenda(row as Record<string, unknown>));
}

export async function getAgenda(client: CrmClient, workspaceId: string, agendaId: string) {
  const { data, error } = await client
    .from("agendas")
    .select(AGENDA_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", agendaId)
    .maybeSingle();

  if (error) {
    throw dbFailure("getAgenda", error);
  }
  if (!data) {
    throw notFound("Esa agenda no existe en esta empresa.");
  }

  return toAgenda(data as Record<string, unknown>);
}

/** La agenda por defecto activa o, si no hay, la primera activa. */
export async function getDefaultAgenda(client: CrmClient, workspaceId: string) {
  const agendas = await listAgendas(client, workspaceId, { activeOnly: true });

  return agendas.find((agenda) => agenda.is_default) ?? agendas[0] ?? null;
}

export async function createAgenda(
  client: CrmClient,
  workspaceId: string,
  input: AgendaInput & { name: unknown; timezone: unknown },
) {
  if (input.timezone === undefined) {
    throw invalid("La agenda necesita una zona horaria.");
  }

  const changes = agendaChanges(input);
  const existing = await listAgendas(client, workspaceId);
  const { data, error } = await client
    .from("agendas")
    .insert({
      active: true,
      closed_dates: [],
      description: "",
      google_sync_mode: "off",
      is_default: existing.length === 0,
      max_days_ahead: 30,
      min_notice_minutes: 60,
      schedule: DEFAULT_WEEKLY_SCHEDULE,
      services: [],
      slot_step_minutes: 30,
      ...changes,
      workspace_id: workspaceId,
    })
    .select(AGENDA_COLUMNS)
    .single();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una agenda con ese nombre.");
  }
  if (error || !data) {
    throw dbFailure("createAgenda", error ?? { message: "sin fila" });
  }

  return toAgenda(data as Record<string, unknown>);
}

export async function updateAgenda(client: CrmClient, workspaceId: string, agendaId: string, input: AgendaInput) {
  const changes = agendaChanges(input);

  if (Object.keys(changes).length === 0) {
    throw invalid("No hay nada que cambiar.");
  }

  const { data, error } = await client
    .from("agendas")
    .update(changes)
    .eq("workspace_id", workspaceId)
    .eq("id", agendaId)
    .select(AGENDA_COLUMNS)
    .maybeSingle();

  if (isUniqueViolation(error)) {
    throw conflict("Ya existe una agenda con ese nombre.");
  }
  if (error) {
    throw dbFailure("updateAgenda", error);
  }
  if (!data) {
    throw notFound("Esa agenda no existe en esta empresa.");
  }

  return toAgenda(data as Record<string, unknown>);
}

/** Marca una agenda como la de por defecto (y desmarca la anterior). */
export async function setDefaultAgenda(client: CrmClient, workspaceId: string, agendaId: string) {
  const agenda = await getAgenda(client, workspaceId, agendaId);

  if (!agenda.active) {
    throw invalid("Una agenda desactivada no puede ser la de por defecto.");
  }

  const { error: clearError } = await client
    .from("agendas")
    .update({ is_default: false })
    .eq("workspace_id", workspaceId)
    .eq("is_default", true);

  if (clearError) {
    throw dbFailure("setDefaultAgenda.clear", clearError);
  }

  const { error } = await client
    .from("agendas")
    .update({ is_default: true })
    .eq("workspace_id", workspaceId)
    .eq("id", agendaId);

  if (error) {
    throw dbFailure("setDefaultAgenda", error);
  }
}
