/** Tipos de la sección Agenda en el navegador (sin importar código de servidor). */

export type ScheduleSegment = { end: string; start: string };

export type AgendaItem = {
  active: boolean;
  closed_dates: string[];
  description: string;
  google_calendar_id: string | null;
  google_sync_mode: "off" | "push" | "push_and_busy";
  id: string;
  is_default: boolean;
  max_days_ahead: number;
  min_notice_minutes: number;
  name: string;
  no_show_enabled: boolean;
  no_show_hours_after: number;
  no_show_message: string | null;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_message: string | null;
  schedule: Record<string, ScheduleSegment[]>;
  services: Array<{ duration_minutes: number; name: string }>;
  slot_step_minutes: number;
  timezone: string;
};

export type AppointmentItem = {
  agenda_id: string;
  confirmed_at: string | null;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  created_by: string;
  ends_at: string;
  id: string;
  notes: string | null;
  service: string;
  starts_at: string;
  status: "cancelled" | "completed" | "no_show" | "rescheduled" | "scheduled";
};

export type BlockItem = { agenda_id: string; ends_at: string; id: string; reason: string | null; starts_at: string };
