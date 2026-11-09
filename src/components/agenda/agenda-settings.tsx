"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";
import { getBrowserTimeZone, getTimeZoneOptions } from "@/lib/timezones";

import { Modal } from "./agenda-dialogs";
import type { AgendaItem, ScheduleSegment } from "./types";
import { clientFetch } from "@/lib/client-fetch";

const inputClass = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none";
const textareaClass = "min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none";
const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium disabled:opacity-60";
const iconButton = "grid size-8 place-items-center rounded-lg border border-line bg-white text-muted";

const DAYS: Array<[string, string]> = [
  ["1", "Lunes"],
  ["2", "Martes"],
  ["3", "Miércoles"],
  ["4", "Jueves"],
  ["5", "Viernes"],
  ["6", "Sábado"],
  ["7", "Domingo"],
];

const SYNC_LABELS: Record<AgendaItem["google_sync_mode"], string> = {
  off: "No sincronizar",
  push: "Copiar las citas a Google",
  push_and_busy: "Copiar las citas y respetar lo ocupado en Google",
};

type Calendar = { id: string; primary: boolean; summary: string };

function emptySchedule(): Record<string, ScheduleSegment[]> {
  const schedule: Record<string, ScheduleSegment[]> = {};
  for (const [day] of DAYS) {
    schedule[day] = Number(day) <= 5 ? [{ end: "18:00", start: "09:00" }] : [];
  }
  return schedule;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <fieldset className="grid gap-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Crea una agenda (`agenda = null`) o edita la configuración de una existente. */
export function AgendaSettingsDialog({
  agenda,
  onClose,
  onSaved,
}: {
  agenda: AgendaItem | null;
  onClose: () => void;
  onSaved: (saved: AgendaItem) => void;
}) {
  const timeZones = useMemo(() => getTimeZoneOptions(), []);
  const [name, setName] = useState(agenda?.name ?? "");
  const [description, setDescription] = useState(agenda?.description ?? "");
  const [timezone, setTimezone] = useState(agenda?.timezone ?? (getBrowserTimeZone() || "Europe/Madrid"));
  const [slotStep, setSlotStep] = useState(String(agenda?.slot_step_minutes ?? 30));
  const [minNotice, setMinNotice] = useState(String(agenda?.min_notice_minutes ?? 60));
  const [maxDays, setMaxDays] = useState(String(agenda?.max_days_ahead ?? 30));
  const [schedule, setSchedule] = useState<Record<string, ScheduleSegment[]>>(() => {
    const base = emptySchedule();
    return agenda ? { ...Object.fromEntries(DAYS.map(([day]) => [day, []])), ...agenda.schedule } : base;
  });
  const [services, setServices] = useState(agenda?.services ?? []);
  const [closedDates, setClosedDates] = useState<string[]>(agenda?.closed_dates ?? []);
  const [newClosedDate, setNewClosedDate] = useState("");
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [calendarNote, setCalendarNote] = useState("");
  const [googleCalendarId, setGoogleCalendarId] = useState(agenda?.google_calendar_id ?? "");
  const [googleSyncMode, setGoogleSyncMode] = useState<AgendaItem["google_sync_mode"]>(agenda?.google_sync_mode ?? "off");
  const [reminderEnabled, setReminderEnabled] = useState(agenda?.reminder_enabled ?? false);
  const [reminderHours, setReminderHours] = useState(String(agenda?.reminder_hours_before ?? 24));
  const [reminderMessage, setReminderMessage] = useState(agenda?.reminder_message ?? "");
  const [noShowEnabled, setNoShowEnabled] = useState(agenda?.no_show_enabled ?? false);
  const [noShowHours, setNoShowHours] = useState(String(agenda?.no_show_hours_after ?? 2));
  const [noShowMessage, setNoShowMessage] = useState(agenda?.no_show_message ?? "");
  const [active, setActive] = useState(agenda?.active ?? true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/google-calendar/calendars")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiError(response, "Conecta Google Calendar en Configuración para elegir un calendario."));
        }
        return (await response.json()) as { calendars: Calendar[] };
      })
      .then((data) => {
        if (!cancelled) setCalendars(data.calendars);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setCalendars([]);
          setCalendarNote(reason instanceof Error ? reason.message : "No se pudieron cargar los calendarios.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateSegment(day: string, index: number, change: Partial<ScheduleSegment>) {
    setSchedule((current) => ({
      ...current,
      [day]: (current[day] ?? []).map((segment, position) => (position === index ? { ...segment, ...change } : segment)),
    }));
  }

  function addSegment(day: string) {
    setSchedule((current) => {
      const segments = current[day] ?? [];
      const last = segments.at(-1);
      return { ...current, [day]: [...segments, last ? { end: "20:00", start: last.end } : { end: "18:00", start: "09:00" }] };
    });
  }

  function removeSegment(day: string, index: number) {
    setSchedule((current) => ({ ...current, [day]: (current[day] ?? []).filter((_, position) => position !== index) }));
  }

  function addClosedDate() {
    if (newClosedDate && !closedDates.includes(newClosedDate)) {
      setClosedDates([...closedDates, newClosedDate].sort());
    }
    setNewClosedDate("");
  }

  async function save() {
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = {
      active,
      closedDates,
      description,
      googleCalendarId: googleCalendarId || null,
      googleSyncMode: googleCalendarId ? googleSyncMode : "off",
      maxDaysAhead: Number(maxDays),
      minNoticeMinutes: Number(minNotice),
      name,
      noShowEnabled,
      noShowHoursAfter: Number(noShowHours),
      noShowMessage,
      reminderEnabled,
      reminderHoursBefore: Number(reminderHours),
      reminderMessage,
      schedule,
      services: services.filter((service) => service.name.trim()),
      slotStepMinutes: Number(slotStep),
      timezone,
    };
    if (agenda && makeDefault) {
      body.makeDefault = true;
    }

    try {
      const response = await clientFetch(agenda ? `/api/agenda/agendas/${agenda.id}` : "/api/agenda/agendas", {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: agenda ? "PATCH" : "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "No se pudo guardar la agenda."));
      }
      const data = (await response.json()) as { agenda: AgendaItem };
      onSaved(data.agenda);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la agenda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={agenda ? `Configurar «${agenda.name}»` : "Nueva agenda"}>
      <Section title="General">
        <Field label="Nombre">
          <input className={inputClass} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
        </Field>
        <Field label="Descripción (la usa el agente para explicar la agenda)">
          <textarea className={textareaClass} maxLength={2000} onChange={(event) => setDescription(event.target.value)} value={description} />
        </Field>
        <Field label="Zona horaria">
          <select className={inputClass} onChange={(event) => setTimezone(event.target.value)} value={timezone}>
            {timeZones.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Huecos cada (min)">
            <input className={inputClass} min={5} max={240} onChange={(event) => setSlotStep(event.target.value)} type="number" value={slotStep} />
          </Field>
          <Field label="Antelación (min)">
            <input className={inputClass} min={0} onChange={(event) => setMinNotice(event.target.value)} type="number" value={minNotice} />
          </Field>
          <Field label="Hasta (días)">
            <input className={inputClass} min={1} max={365} onChange={(event) => setMaxDays(event.target.value)} type="number" value={maxDays} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
          Agenda activa (el agente puede reservar en ella)
        </label>
        {agenda && !agenda.is_default ? (
          <label className="flex items-center gap-2 text-sm">
            <input checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} type="checkbox" />
            Usarla como agenda por defecto
          </label>
        ) : null}
      </Section>

      <Section title="Horario semanal">
        {DAYS.map(([day, label]) => {
          const segments = schedule[day] ?? [];
          return (
            <div className="grid gap-1" key={day}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{label}</span>
                <button className={iconButton} aria-label={`Añadir tramo el ${label}`} onClick={() => addSegment(day)} type="button">
                  <Plus size={14} />
                </button>
              </div>
              {segments.length === 0 ? <p className="text-xs text-muted">Cerrado</p> : null}
              {segments.map((segment, index) => (
                <div className="flex items-center gap-2" key={index}>
                  <input className={inputClass} onChange={(event) => updateSegment(day, index, { start: event.target.value })} type="time" value={segment.start} />
                  <span className="text-sm text-muted">a</span>
                  <input className={inputClass} onChange={(event) => updateSegment(day, index, { end: event.target.value })} type="time" value={segment.end} />
                  <button className={iconButton} aria-label="Quitar tramo" onClick={() => removeSegment(day, index)} type="button">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </Section>

      <Section title="Servicios">
        {services.length === 0 ? <p className="text-xs text-muted">Sin servicios: las citas usan la duración por defecto.</p> : null}
        {services.map((service, index) => (
          <div className="flex items-center gap-2" key={index}>
            <input
              className={inputClass}
              onChange={(event) =>
                setServices(services.map((item, position) => (position === index ? { ...item, name: event.target.value } : item)))
              }
              placeholder="Nombre del servicio"
              value={service.name}
            />
            <input
              className={`${inputClass} w-24`}
              min={5}
              onChange={(event) =>
                setServices(
                  services.map((item, position) => (position === index ? { ...item, duration_minutes: Number(event.target.value) } : item)),
                )
              }
              type="number"
              value={service.duration_minutes}
            />
            <span className="text-sm text-muted">min</span>
            <button
              className={iconButton}
              aria-label="Quitar servicio"
              onClick={() => setServices(services.filter((_, position) => position !== index))}
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button className={secondaryButton} onClick={() => setServices([...services, { duration_minutes: 30, name: "" }])} type="button">
          <Plus size={16} /> Añadir servicio
        </button>
      </Section>

      <Section title="Días cerrados">
        <div className="flex flex-wrap gap-2">
          {closedDates.length === 0 ? <p className="text-xs text-muted">Ninguno.</p> : null}
          {closedDates.map((date) => (
            <button
              className="rounded-full border border-line px-2 py-1 text-xs"
              key={date}
              onClick={() => setClosedDates(closedDates.filter((item) => item !== date))}
              title="Quitar"
              type="button"
            >
              {date} ×
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input className={inputClass} onChange={(event) => setNewClosedDate(event.target.value)} type="date" value={newClosedDate} />
          <button className={secondaryButton} disabled={!newClosedDate} onClick={addClosedDate} type="button">
            Añadir
          </button>
        </div>
      </Section>

      <Section title="Google Calendar">
        {calendars === null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="animate-spin" size={14} /> Cargando calendarios…
          </p>
        ) : calendars.length === 0 ? (
          <p className="text-sm text-muted">{calendarNote || "No hay calendarios con permiso de escritura."}</p>
        ) : (
          <>
            <Field label="Calendario">
              <select className={inputClass} onChange={(event) => setGoogleCalendarId(event.target.value)} value={googleCalendarId}>
                <option value="">Ninguno</option>
                {googleCalendarId && !calendars.some((item) => item.id === googleCalendarId) ? (
                  <option value={googleCalendarId}>{googleCalendarId}</option>
                ) : null}
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                    {calendar.primary ? " (principal)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sincronización">
              <select
                className={inputClass}
                disabled={!googleCalendarId}
                onChange={(event) => setGoogleSyncMode(event.target.value as AgendaItem["google_sync_mode"])}
                value={googleCalendarId ? googleSyncMode : "off"}
              >
                {(Object.keys(SYNC_LABELS) as Array<AgendaItem["google_sync_mode"]>).map((mode) => (
                  <option key={mode} value={mode}>
                    {SYNC_LABELS[mode]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section title="Recordatorio por WhatsApp">
        <label className="flex items-center gap-2 text-sm">
          <input checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} type="checkbox" />
          Enviar un recordatorio antes de la cita
        </label>
        {reminderEnabled ? (
          <>
            <Field label="Horas antes">
              <input className={inputClass} max={72} min={1} onChange={(event) => setReminderHours(event.target.value)} type="number" value={reminderHours} />
            </Field>
            <Field label="Mensaje (vacío = texto por defecto)">
              <textarea className={textareaClass} maxLength={1000} onChange={(event) => setReminderMessage(event.target.value)} value={reminderMessage} />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Si no asiste">
        <label className="flex items-center gap-2 text-sm">
          <input checked={noShowEnabled} onChange={(event) => setNoShowEnabled(event.target.checked)} type="checkbox" />
          Escribirle para reagendar cuando se marque «No asistió»
        </label>
        {noShowEnabled ? (
          <>
            <Field label="Horas después">
              <input className={inputClass} max={72} min={0} onChange={(event) => setNoShowHours(event.target.value)} type="number" value={noShowHours} />
            </Field>
            <Field label="Mensaje (vacío = texto por defecto)">
              <textarea className={textareaClass} maxLength={1000} onChange={(event) => setNoShowMessage(event.target.value)} value={noShowMessage} />
            </Field>
          </>
        ) : null}
      </Section>

      {error ? <p className="text-sm text-[#a33a2b]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button className={secondaryButton} onClick={onClose} type="button">
          Cancelar
        </button>
        <button className={primaryButton} disabled={busy || !name.trim() || !timezone} onClick={save} type="button">
          {busy ? <Loader2 className="animate-spin" size={16} /> : null}
          {agenda ? "Guardar" : "Crear agenda"}
        </button>
      </div>
    </Modal>
  );
}
