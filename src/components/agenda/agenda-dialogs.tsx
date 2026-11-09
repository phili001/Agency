"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";
import { zonedDateTime } from "@/lib/timezones";

import type { AgendaItem, AppointmentItem } from "./types";
import { clientFetch } from "@/lib/client-fetch";

const inputClass = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none";
const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium disabled:opacity-60";

const STATUS_LABELS: Record<AppointmentItem["status"], string> = {
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
  rescheduled: "Cambiada",
  scheduled: "Agendada",
};

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4 backdrop-blur-sm" onClick={onClose} role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 grid gap-3">{children}</div>
      </div>
    </div>
  );
}

function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

/** Huecos libres de un día; también deja escribir una hora a mano (el equipo puede ir fuera de horario). */
function SlotPicker({
  agenda,
  date,
  exclude,
  onChange,
  service,
  value,
}: {
  agenda: AgendaItem;
  date: string;
  exclude?: string;
  onChange: (startsAt: string) => void;
  service: string;
  value: string;
}) {
  const [slots, setSlots] = useState<Array<{ label: string; startsAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    const params = new URLSearchParams({ agendaId: agenda.id, date });
    if (service) params.set("service", service);
    if (exclude) params.set("exclude", exclude);
    // Huecos del día elegido; se vuelven a pedir al cambiar día o servicio.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/agenda/slots?${params.toString()}`)
      .then(async (response) => (response.ok ? ((await response.json()) as { slots: Array<{ label: string; startsAt: string }> }).slots : []))
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agenda.id, date, exclude, service]);

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Hora</p>
      {loading ? <Loader2 className="animate-spin text-muted" size={16} /> : null}
      {!loading && slots.length === 0 ? <p className="text-xs text-muted">No hay huecos libres ese día en el horario.</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <button
            className={`h-8 rounded-md border px-2 text-sm ${value === slot.startsAt ? "border-ink bg-ink text-paper" : "border-line bg-white"}`}
            key={slot.startsAt}
            onClick={() => {
              setManual("");
              onChange(slot.startsAt);
            }}
            type="button"
          >
            {slot.label}
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-xs text-muted">
        Otra hora (fuera del horario, solo si hace falta)
        <input
          className={inputClass}
          onChange={(event) => {
            setManual(event.target.value);
            const instant = event.target.value ? zonedDateTime(date, event.target.value, agenda.timezone) : null;
            onChange(instant ? instant.toISOString() : "");
          }}
          type="time"
          value={manual}
        />
      </label>
    </div>
  );
}

export function NewAppointmentDialog({
  agenda,
  defaultDate,
  onClose,
  onDone,
}: {
  agenda: AgendaItem;
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ full_name: string | null; id: string; phone_e164: string }>>([]);
  const [contact, setContact] = useState<{ id: string; label: string } | null>(null);
  const [service, setService] = useState(agenda.services[0]?.name ?? "");
  const [date, setDate] = useState(defaultDate);
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (contact || query.trim().length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      const response = await clientFetch(`/api/crm/contacts?q=${encodeURIComponent(query.trim())}&pageSize=8`);
      if (response.ok) {
        setResults(((await response.json()) as { contacts: Array<{ full_name: string | null; id: string; phone_e164: string }> }).contacts);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [contact, query]);

  async function save() {
    setSaving(true);
    setError("");
    const response = await clientFetch("/api/agenda/appointments", {
      body: JSON.stringify({ agendaId: agenda.id, contactId: contact?.id, notes, service, startsAt }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSaving(false);
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo crear la cita."));
      return;
    }
    onDone();
  }

  return (
    <Modal onClose={onClose} title="Nueva cita">
      <label className="grid gap-1 text-sm font-medium">
        Contacto
        {contact ? (
          <span className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm font-normal">
            {contact.label}
            <button aria-label="Cambiar contacto" onClick={() => setContact(null)} type="button">
              <X size={14} />
            </button>
          </span>
        ) : (
          <>
            <input className={inputClass} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre o teléfono" value={query} />
            {results.length > 0 ? (
              <div className="grid rounded-lg border border-line">
                {results.map((item) => (
                  <button
                    className="px-3 py-2 text-left text-sm font-normal hover:bg-paper-2"
                    key={item.id}
                    onClick={() => {
                      setContact({ id: item.id, label: `${item.full_name ?? "Sin nombre"} · ${item.phone_e164}` });
                      setResults([]);
                    }}
                    type="button"
                  >
                    {item.full_name ?? "Sin nombre"} <span className="text-muted">{item.phone_e164}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Servicio
        {agenda.services.length > 0 ? (
          <select className={inputClass} onChange={(event) => setService(event.target.value)} value={service}>
            {agenda.services.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} ({item.duration_minutes} min)
              </option>
            ))}
          </select>
        ) : (
          <input className={inputClass} onChange={(event) => setService(event.target.value)} placeholder="Cita (30 min)" value={service} />
        )}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Día
        <input className={inputClass} onChange={(event) => { setDate(event.target.value); setStartsAt(""); }} type="date" value={date} />
      </label>
      <SlotPicker agenda={agenda} date={date} onChange={setStartsAt} service={service} value={startsAt} />
      <textarea
        className="min-h-16 rounded-lg border border-line px-3 py-2 text-sm outline-none"
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notas (opcional)"
        value={notes}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button className={secondaryButton} onClick={onClose} type="button">
          Cancelar
        </button>
        <button className={primaryButton} disabled={!contact || !startsAt || saving} onClick={save} type="button">
          {saving ? <Loader2 className="animate-spin" size={15} /> : null}
          Agendar
        </button>
      </div>
    </Modal>
  );
}

export function AppointmentDialog({
  agenda,
  appointment,
  canEdit,
  onClose,
  onDone,
}: {
  agenda: AgendaItem;
  appointment: AppointmentItem;
  canEdit: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: agenda.timezone }).format(new Date(appointment.starts_at)),
  );
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const active = appointment.status === "scheduled" || appointment.status === "rescheduled";
  const started = new Date(appointment.starts_at) <= new Date();

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError("");
    const response = await clientFetch(`/api/agenda/appointments/${appointment.id}`, {
      body: JSON.stringify({ action, ...extra }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    setBusy("");
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo actualizar la cita."));
      return;
    }
    onDone();
  }

  return (
    <Modal onClose={onClose} title={appointment.contact_name ?? appointment.contact_phone ?? "Cita"}>
      <div className="grid gap-1 text-sm">
        <p className="font-medium capitalize">{when(appointment.starts_at, agenda.timezone)}</p>
        {appointment.service ? <p className="text-muted">{appointment.service}</p> : null}
        {appointment.contact_phone ? <p className="text-muted">{appointment.contact_phone}</p> : null}
        <p>
          <span className="rounded-md bg-paper-2 px-1.5 py-0.5 text-xs">{STATUS_LABELS[appointment.status]}</span>
          {appointment.confirmed_at ? <span className="ml-2 text-xs text-ink">Confirmada por el cliente</span> : null}
          <span className="ml-2 text-xs text-muted">
            {appointment.created_by === "agent" ? "Agendada por el agente IA" : appointment.created_by === "flow" ? "Agendada por un flujo" : "Agendada por el equipo"}
          </span>
        </p>
        {appointment.notes ? <p className="whitespace-pre-line rounded-lg bg-paper-2 p-2 text-ink-2">{appointment.notes}</p> : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {canEdit && active ? (
        moving ? (
          <div className="grid gap-2 rounded-lg border border-line p-3">
            <label className="grid gap-1 text-sm font-medium">
              Nuevo día
              <input className={inputClass} onChange={(event) => { setDate(event.target.value); setStartsAt(""); }} type="date" value={date} />
            </label>
            <SlotPicker agenda={agenda} date={date} exclude={appointment.id} onChange={setStartsAt} service={appointment.service} value={startsAt} />
            <div className="flex justify-end gap-2">
              <button className={secondaryButton} onClick={() => setMoving(false)} type="button">
                Volver
              </button>
              <button className={primaryButton} disabled={!startsAt || busy === "reschedule"} onClick={() => void act("reschedule", { startsAt })} type="button">
                {busy === "reschedule" ? <Loader2 className="animate-spin" size={15} /> : null}
                Mover cita
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!appointment.confirmed_at && !started ? (
              <button className={secondaryButton} disabled={Boolean(busy)} onClick={() => void act("confirm")} type="button">
                Marcar confirmada
              </button>
            ) : null}
            {started ? (
              <>
                <button className={secondaryButton} disabled={Boolean(busy)} onClick={() => void act("completed")} type="button">
                  Completada
                </button>
                <button className={secondaryButton} disabled={Boolean(busy)} onClick={() => void act("no_show")} type="button">
                  No asistió
                </button>
              </>
            ) : null}
            <button className={secondaryButton} disabled={Boolean(busy)} onClick={() => setMoving(true)} type="button">
              Mover
            </button>
            <button
              className="inline-flex h-10 items-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
              disabled={Boolean(busy)}
              onClick={() => {
                const reason = window.prompt("¿Cancelar la cita? Puedes escribir el motivo (opcional).");
                if (reason !== null) void act("cancel", { reason });
              }}
              type="button"
            >
              Cancelar cita
            </button>
          </div>
        )
      ) : null}
    </Modal>
  );
}

export function BlockDialog({
  agenda,
  defaultDate,
  onClose,
  onDone,
}: {
  agenda: AgendaItem;
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [from, setFrom] = useState("14:00");
  const [to, setTo] = useState("15:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const start = zonedDateTime(date, allDay ? "00:00" : from, agenda.timezone);
    const end = zonedDateTime(date, allDay ? "24:00" : to, agenda.timezone);
    if (!start || !end || end <= start) {
      setError("Revisa las horas: el final tiene que ser después del inicio.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await clientFetch("/api/agenda/blocks", {
      body: JSON.stringify({ agendaId: agenda.id, endsAt: end.toISOString(), reason, startsAt: start.toISOString() }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSaving(false);
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo bloquear el horario."));
      return;
    }
    onDone();
  }

  return (
    <Modal onClose={onClose} title="Bloquear horario">
      <p className="text-sm text-muted">En ese tramo no se ofrecerán huecos a nadie (comida, vacaciones, un curso…).</p>
      <label className="grid gap-1 text-sm font-medium">
        Día
        <input className={inputClass} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input checked={allDay} onChange={(event) => setAllDay(event.target.checked)} type="checkbox" />
        Todo el día
      </label>
      {!allDay ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-medium">
            Desde
            <input className={inputClass} onChange={(event) => setFrom(event.target.value)} type="time" value={from} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Hasta
            <input className={inputClass} onChange={(event) => setTo(event.target.value)} type="time" value={to} />
          </label>
        </div>
      ) : null}
      <input className={inputClass} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (opcional)" value={reason} />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button className={secondaryButton} onClick={onClose} type="button">
          Cancelar
        </button>
        <button className={primaryButton} disabled={saving} onClick={save} type="button">
          {saving ? <Loader2 className="animate-spin" size={15} /> : null}
          Bloquear
        </button>
      </div>
    </Modal>
  );
}
