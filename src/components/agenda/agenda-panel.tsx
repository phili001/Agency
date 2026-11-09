"use client";

import { useEffect, useState } from "react";
import { Ban, CalendarPlus, ChevronLeft, ChevronRight, Loader2, Plus, Settings2 } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  getZonedParts,
  isoWeekdayOfDateKey,
  zonedStartOfDay,
} from "@/lib/timezones";

import { AppointmentDialog, BlockDialog, NewAppointmentDialog } from "./agenda-dialogs";
import { AgendaSettingsDialog } from "./agenda-settings";
import type { AgendaItem, AppointmentItem, BlockItem } from "./types";
import { clientFetch } from "@/lib/client-fetch";

const STATUS_STYLES: Record<AppointmentItem["status"], string> = {
  cancelled: "border-line bg-paper-2 text-faint line-through",
  completed: "border-line-strong bg-white",
  no_show: "border-[#f1c9bf] bg-[#fbeeea]",
  rescheduled: "border-yellow-strong bg-yellow-soft",
  scheduled: "border-yellow-strong bg-yellow-soft",
};

const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink disabled:opacity-50";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium disabled:opacity-60";

function timeIn(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function dayLabel(dateKey: string, timezone: string) {
  const instant = zonedStartOfDay(dateKey, timezone) ?? new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: timezone, weekday: "long" }).format(instant);
}

export function AgendaPanel({
  canEdit,
  canManage,
  initialAgendas,
}: {
  /** owner/admin/agent: crear, mover y cancelar citas, bloqueos. */
  canEdit: boolean;
  /** owner/admin: crear y configurar agendas. */
  canManage: boolean;
  initialAgendas: AgendaItem[];
}) {
  const [agendas, setAgendas] = useState(initialAgendas);
  const [agendaId, setAgendaId] = useState(
    (initialAgendas.find((agenda) => agenda.is_default) ?? initialAgendas[0])?.id ?? "",
  );
  const agenda = agendas.find((item) => item.id === agendaId) ?? null;
  const timezone = agenda?.timezone ?? "UTC";
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => dateKeyInTimeZone(timezone));
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "appointment"; item: AppointmentItem }
    | { kind: "block" }
    | { kind: "new" }
    | { kind: "settings"; agenda: AgendaItem | null }
    | null
  >(null);

  const [reloadKey, setReloadKey] = useState(0);

  let days = [anchor];
  if (view === "week") {
    const monday = addDaysToDateKey(anchor, 1 - (isoWeekdayOfDateKey(anchor) ?? 1));
    days = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(monday, index));
  }
  const firstDay = days[0];
  const lastDay = days.at(-1)!;

  // Pide otra vez las citas del rango visible (tras crear, mover o cancelar).
  function load() {
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    // Recarga al cambiar de agenda, rango, filtro o tras un cambio.
    if (!agendaId) return;
    let cancelled = false;
    const from = zonedStartOfDay(firstDay, timezone);
    const to = zonedStartOfDay(addDaysToDateKey(lastDay, 1), timezone);
    const params = new URLSearchParams({
      agendaId,
      cancelled: showCancelled ? "1" : "0",
      from: (from ?? new Date()).toISOString(),
      to: (to ?? new Date()).toISOString(),
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    void (async () => {
      const response = await clientFetch(`/api/agenda/appointments?${params.toString()}`);
      if (cancelled) return;
      setLoading(false);
      if (!response.ok) {
        setError(await readApiError(response, "No se pudo cargar la agenda."));
        return;
      }
      const payload = (await response.json()) as { appointments: AppointmentItem[]; blocks: BlockItem[] };
      if (cancelled) return;
      setAppointments(payload.appointments);
      setBlocks(payload.blocks);
    })();
    return () => {
      cancelled = true;
    };
  }, [agendaId, firstDay, lastDay, reloadKey, showCancelled, timezone]);

  const byDay = (() => {
    const groups = new Map(days.map((day) => [day, [] as Array<{ kind: "appointment"; item: AppointmentItem } | { kind: "block"; item: BlockItem }>]));
    for (const item of appointments) {
      groups.get(getZonedParts(new Date(item.starts_at), timezone).dateKey)?.push({ item, kind: "appointment" });
    }
    for (const item of blocks) {
      groups.get(getZonedParts(new Date(item.starts_at), timezone).dateKey)?.push({ item, kind: "block" });
    }
    for (const list of groups.values()) {
      list.sort((a, b) => new Date(a.item.starts_at).getTime() - new Date(b.item.starts_at).getTime());
    }
    return groups;
  })();

  async function deleteBlock(id: string) {
    if (!window.confirm("¿Quitar este bloqueo?")) return;
    const response = await clientFetch(`/api/agenda/blocks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo quitar el bloqueo."));
      return;
    }
    load();
  }

  if (agendas.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-white p-6 text-center">
        <h2 className="text-base font-semibold">Todavía no hay ninguna agenda</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Crea tu agenda con tu horario y tus servicios. El agente de WhatsApp la usará para ofrecer huecos y agendar citas.
        </p>
        {canManage ? (
          <button className={`${primaryButton} mt-4`} onClick={() => setDialog({ agenda: null, kind: "settings" })} type="button">
            <Plus size={15} /> Crear agenda
          </button>
        ) : (
          <p className="mt-3 text-sm text-muted">Pide al dueño o a un admin que la cree.</p>
        )}
        {dialog?.kind === "settings" ? (
          <AgendaSettingsDialog
            agenda={null}
            onClose={() => setDialog(null)}
            onSaved={(saved) => {
              setAgendas([saved]);
              setAgendaId(saved.id);
              setDialog(null);
            }}
          />
        ) : null}
      </section>
    );
  }

  const step = view === "day" ? 1 : 7;

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Agenda"
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium outline-none"
            onChange={(event) => setAgendaId(event.target.value)}
            value={agendaId}
          >
            {agendas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_default ? " (por defecto)" : ""}
                {item.active ? "" : " · desactivada"}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(["week", "day"] as const).map((value) => (
              <button
                aria-pressed={view === value}
                className={`h-9 rounded-md px-3 text-sm ${view === value ? "bg-paper-2 font-medium" : ""}`}
                key={value}
                onClick={() => setView(value)}
                type="button"
              >
                {value === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          <button aria-label="Anterior" className={secondaryButton} onClick={() => setAnchor(addDaysToDateKey(anchor, -step))} type="button">
            <ChevronLeft size={16} />
          </button>
          <button className={secondaryButton} onClick={() => setAnchor(dateKeyInTimeZone(timezone))} type="button">
            Hoy
          </button>
          <button aria-label="Siguiente" className={secondaryButton} onClick={() => setAnchor(addDaysToDateKey(anchor, step))} type="button">
            <ChevronRight size={16} />
          </button>
          {loading ? <Loader2 className="animate-spin text-muted" size={16} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-sm text-ink-2">
            <input checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} type="checkbox" />
            Ver canceladas
          </label>
          {canManage ? (
            <>
              <button className={secondaryButton} onClick={() => setDialog({ agenda, kind: "settings" })} type="button">
                <Settings2 size={15} /> Configurar
              </button>
              <button className={secondaryButton} onClick={() => setDialog({ agenda: null, kind: "settings" })} type="button">
                <Plus size={15} /> Nueva agenda
              </button>
            </>
          ) : null}
          {canEdit ? (
            <>
              <button className={secondaryButton} onClick={() => setDialog({ kind: "block" })} type="button">
                <Ban size={15} /> Bloquear horario
              </button>
              <button className={primaryButton} disabled={!agenda?.active} onClick={() => setDialog({ kind: "new" })} type="button">
                <CalendarPlus size={15} /> Nueva cita
              </button>
            </>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Horas en {timezone}.{agenda && !agenda.active ? " Esta agenda está desactivada: no se pueden crear citas nuevas." : ""}
      </p>
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className={`mt-3 grid gap-2 ${view === "week" ? "md:grid-cols-7" : ""}`}>
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const isToday = day === dateKeyInTimeZone(timezone);
          const closed = agenda?.closed_dates.includes(day);
          return (
            <div className={`min-h-32 rounded-lg border p-2 ${isToday ? "border-ink" : "border-line"} bg-paper-2`} key={day}>
              <p className="text-xs font-semibold capitalize">{dayLabel(day, timezone)}</p>
              {closed ? <p className="text-[11px] text-[#7a2f1d]">Festivo</p> : null}
              <div className="mt-1.5 grid gap-1.5">
                {items.map((entry) =>
                  entry.kind === "appointment" ? (
                    <button
                      className={`rounded-md border px-2 py-1.5 text-left text-xs ${STATUS_STYLES[entry.item.status]}`}
                      key={entry.item.id}
                      onClick={() => setDialog({ item: entry.item, kind: "appointment" })}
                      type="button"
                    >
                      <span className="font-semibold">
                        {timeIn(entry.item.starts_at, timezone)}–{timeIn(entry.item.ends_at, timezone)}
                      </span>{" "}
                      {entry.item.contact_name ?? entry.item.contact_phone ?? "Contacto"}
                      {entry.item.service ? <span className="block text-muted">{entry.item.service}</span> : null}
                    </button>
                  ) : (
                    <div className="flex items-start justify-between gap-1 rounded-md border border-dashed border-line bg-white px-2 py-1.5 text-xs text-muted" key={entry.item.id}>
                      <span>
                        <span className="font-semibold">
                          {timeIn(entry.item.starts_at, timezone)}–{timeIn(entry.item.ends_at, timezone)}
                        </span>{" "}
                        Bloqueado{entry.item.reason ? `: ${entry.item.reason}` : ""}
                      </span>
                      {canEdit ? (
                        <button aria-label="Quitar bloqueo" onClick={() => void deleteBlock(entry.item.id)} type="button">
                          ×
                        </button>
                      ) : null}
                    </div>
                  ),
                )}
                {items.length === 0 ? <p className="text-[11px] text-faint">Sin citas</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      {dialog?.kind === "appointment" && agenda ? (
        <AppointmentDialog
          agenda={agenda}
          appointment={dialog.item}
          canEdit={canEdit}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      ) : null}
      {dialog?.kind === "new" && agenda ? (
        <NewAppointmentDialog
          agenda={agenda}
          defaultDate={view === "day" ? anchor : dateKeyInTimeZone(timezone)}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      ) : null}
      {dialog?.kind === "block" && agenda ? (
        <BlockDialog
          agenda={agenda}
          defaultDate={view === "day" ? anchor : dateKeyInTimeZone(timezone)}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      ) : null}
      {dialog?.kind === "settings" ? (
        <AgendaSettingsDialog
          agenda={dialog.agenda}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setAgendas((current) => {
              const exists = current.some((item) => item.id === saved.id);
              const next = exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
              return saved.is_default ? next.map((item) => ({ ...item, is_default: item.id === saved.id })) : next;
            });
            setAgendaId(saved.id);
            setDialog(null);
          }}
        />
      ) : null}
    </section>
  );
}
