"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, MessageSquareText, Trash2, X } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";

import type { ContactCard, CrmFieldOption, CrmPanelOptions } from "./types";

const inputClass = "h-9 w-full rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none";
const smallButton =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-[#cbd2c6] bg-white px-2.5 text-sm font-medium disabled:opacity-60";
const primaryButton =
  "inline-flex h-9 items-center gap-1 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]";

const ACTIVITY_LABELS: Record<string, string> = {
  appointment_booked: "Cita agendada",
  appointment_cancelled: "Cita cancelada",
  appointment_rescheduled: "Cita cambiada",
  contact_created: "Contacto creado",
  contact_updated: "Datos actualizados",
  message_received: "Nueva conversación",
  no_show_sent: "Aviso de inasistencia enviado",
  no_show_skipped: "Aviso de inasistencia omitido",
  note_added: "Nota añadida",
  reminder_sent: "Recordatorio enviado",
  reminder_skipped: "Recordatorio omitido",
  stage_changed: "Cambio de etapa",
  tag_added: "Etiqueta puesta",
  tag_removed: "Etiqueta quitada",
  task_completed: "Tarea completada",
  task_created: "Tarea creada",
};

const ACTOR_LABELS: Record<string, string> = {
  agent: "agente IA",
  flow: "flujo",
  import: "importación",
  operator: "equipo",
  stripe: "Stripe",
  system: "sistema",
};

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
  rescheduled: "Cambiada",
  scheduled: "Agendada",
};

function when(value: string | null, withTime = true) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function activityDetail(entry: ContactCard["activity"][number]) {
  const data = entry.data && typeof entry.data === "object" ? (entry.data as Record<string, unknown>) : {};
  if (entry.kind === "stage_changed") return `${data.from ?? "—"} → ${data.to ?? ""}`;
  if (entry.kind === "tag_added" || entry.kind === "tag_removed") return String(data.tag_name ?? "");
  if (typeof data.reason === "string" && data.reason) return data.reason;
  if (typeof data.title === "string") return data.title;
  return "";
}

function FieldInput({
  field,
  onChange,
  value,
}: {
  field: CrmFieldOption;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  if (field.type === "boolean") {
    return (
      <select className={inputClass} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "true")} value={value === true ? "true" : value === false ? "false" : ""}>
        <option value="">—</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (field.type === "select") {
    return (
      <select className={inputClass} onChange={(event) => onChange(event.target.value || null)} value={typeof value === "string" ? value : ""}>
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "multi") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {field.options.map((option) => (
          <label className="inline-flex items-center gap-1 rounded-md border border-[#e2e6df] px-2 py-1 text-xs" key={option}>
            <input
              checked={selected.includes(option)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))
              }
              type="checkbox"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "long_text") {
    return (
      <textarea
        className="min-h-20 w-full rounded-lg border border-[#cbd2c6] px-3 py-2 text-sm outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={typeof value === "string" ? value : ""}
      />
    );
  }
  const type = field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text";
  return (
    <input
      className={inputClass}
      onChange={(event) => onChange(event.target.value)}
      step={field.type === "money" ? "0.01" : undefined}
      type={type}
      value={value === undefined || value === null ? "" : String(value)}
    />
  );
}

export function ContactDrawer({
  canDelete,
  contactId,
  onChanged,
  onClose,
  onDeleted,
  options,
}: {
  canDelete: boolean;
  contactId: string;
  onChanged: () => void;
  onClose: () => void;
  onDeleted: () => void;
  options: CrmPanelOptions;
}) {
  const [card, setCard] = useState<ContactCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [details, setDetails] = useState({ company: "", email: "", fullName: "" });
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState({ dueAt: "", title: "" });

  const load = useCallback(async () => {
    const response = await fetch(`/api/crm/contacts/${contactId}`);
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo abrir la ficha."));
      return;
    }
    const payload = (await response.json()) as ContactCard;
    setCard(payload);
    setDetails({
      company: payload.contact.company ?? "",
      email: payload.contact.email ?? "",
      fullName: payload.contact.full_name ?? "",
    });
    setFields(payload.contact.custom_fields ?? {});
  }, [contactId]);

  useEffect(() => {
    // Carga inicial de la ficha al abrirla; `load` no cambia mientras siga abierta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function call(key: string, url: string, init: RequestInit, fallback: string) {
    setBusy(key);
    setError("");
    const response = await fetch(url, {
      ...init,
      headers: init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    });
    setBusy("");
    if (!response.ok) {
      setError(await readApiError(response, fallback));
      return false;
    }
    await load();
    onChanged();
    return true;
  }

  if (!card) {
    return (
      <Shell onClose={onClose} title="Ficha del contacto">
        {error ? <p className="text-sm text-red-700">{error}</p> : <Loader2 className="animate-spin" size={18} />}
      </Shell>
    );
  }

  const tagIds = new Set(card.tags.map((tag) => tag.id));
  const availableTags = options.tags.filter((tag) => !tagIds.has(tag.id));
  const upcoming = card.appointments.filter((item) => new Date(item.starts_at) > new Date() && ["scheduled", "rescheduled"].includes(item.status));

  return (
    <Shell onClose={onClose} title={card.contact.full_name ?? card.contact.phone_e164}>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[#647067]">{card.contact.phone_e164}</span>
        {card.conversationId ? (
          <a className={smallButton} href={`/?conversacion=${card.conversationId}`}>
            <MessageSquareText size={14} /> Abrir conversación
          </a>
        ) : null}
      </div>

      <Block title="Etapa">
        <select
          className={inputClass}
          disabled={busy === "stage"}
          onChange={(event) =>
            void call("stage", `/api/crm/contacts/${contactId}/stage`, { body: JSON.stringify({ stageId: event.target.value }), method: "POST" }, "No se pudo cambiar la etapa.")
          }
          value={card.stage?.id ?? ""}
        >
          {card.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </Block>

      <Block title="Etiquetas">
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#e2e6df] px-1.5 py-0.5 text-xs" key={tag.id}>
              <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
              <button
                aria-label={`Quitar ${tag.name}`}
                onClick={() => void call("tag", `/api/crm/contacts/${contactId}/tags?tagId=${tag.id}`, { method: "DELETE" }, "No se pudo quitar la etiqueta.")}
                type="button"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {card.tags.length === 0 ? <span className="text-xs text-[#647067]">Sin etiquetas.</span> : null}
        </div>
        {availableTags.length > 0 ? (
          <select
            className={`${inputClass} mt-2`}
            onChange={(event) => {
              if (event.target.value) {
                void call("tag", `/api/crm/contacts/${contactId}/tags`, { body: JSON.stringify({ tagId: event.target.value }), method: "POST" }, "No se pudo poner la etiqueta.");
              }
            }}
            value=""
          >
            <option value="">Poner etiqueta…</option>
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        ) : null}
      </Block>

      <Block title="Datos">
        <div className="grid gap-2">
          <input className={inputClass} onChange={(event) => setDetails({ ...details, fullName: event.target.value })} placeholder="Nombre" value={details.fullName} />
          <input className={inputClass} onChange={(event) => setDetails({ ...details, email: event.target.value })} placeholder="Correo" type="email" value={details.email} />
          <input className={inputClass} onChange={(event) => setDetails({ ...details, company: event.target.value })} placeholder="Empresa" value={details.company} />
          {card.customFields.map((field) => (
            <label className="grid gap-1 text-xs font-medium text-[#4d5a51]" key={field.id}>
              {field.label}
              <FieldInput field={field} onChange={(value) => setFields({ ...fields, [field.key]: value })} value={fields[field.key]} />
            </label>
          ))}
          <div>
            <button
              className={primaryButton}
              disabled={busy === "details"}
              onClick={() => {
                const changed: Record<string, unknown> = {};
                for (const field of card.customFields) {
                  if (JSON.stringify(fields[field.key] ?? null) !== JSON.stringify(card.contact.custom_fields?.[field.key] ?? null)) {
                    changed[field.key] = fields[field.key] ?? null;
                  }
                }
                void call(
                  "details",
                  `/api/crm/contacts/${contactId}`,
                  {
                    body: JSON.stringify({
                      ...details,
                      customFields: Object.keys(changed).length > 0 ? changed : undefined,
                    }),
                    method: "PATCH",
                  },
                  "No se pudieron guardar los datos.",
                );
              }}
              type="button"
            >
              {busy === "details" ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Guardar datos
            </button>
          </div>
        </div>
      </Block>

      <Block title="Citas">
        {card.appointments.length === 0 ? <p className="text-xs text-[#647067]">Sin citas.</p> : null}
        <div className="grid gap-1.5">
          {card.appointments.map((appointment) => (
            <div className="flex items-center gap-2 rounded-lg border border-[#e2e6df] p-2 text-sm" key={appointment.id}>
              <CalendarClock className="text-[#647067]" size={15} />
              <span className="font-medium">{when(appointment.starts_at)}</span>
              <span className="text-[#647067]">{appointment.service}</span>
              <span className="ml-auto rounded-md bg-[#eef2eb] px-1.5 py-0.5 text-xs">{STATUS_LABELS[appointment.status] ?? appointment.status}</span>
            </div>
          ))}
        </div>
        {upcoming.length > 0 ? <p className="mt-1 text-xs text-[#647067]">Próxima: {when(upcoming.at(-1)!.starts_at)}</p> : null}
      </Block>

      <Block title="Tareas">
        <div className="grid gap-1.5">
          {card.tasks.map((task) => (
            <label className="flex items-center gap-2 rounded-lg border border-[#e2e6df] p-2 text-sm" key={task.id}>
              <input
                checked={Boolean(task.completed_at)}
                onChange={(event) =>
                  void call("task", `/api/crm/tasks/${task.id}`, { body: JSON.stringify({ completed: event.target.checked }), method: "PATCH" }, "No se pudo actualizar la tarea.")
                }
                type="checkbox"
              />
              <span className={task.completed_at ? "text-[#9aa59e] line-through" : ""}>{task.title}</span>
              {task.due_at ? <span className="ml-auto text-xs text-[#647067]">{when(task.due_at, false)}</span> : null}
            </label>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
          <input className={inputClass} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} placeholder="Nueva tarea" value={taskDraft.title} />
          <input className={inputClass} onChange={(event) => setTaskDraft({ ...taskDraft, dueAt: event.target.value })} type="date" value={taskDraft.dueAt} />
          <button
            className={smallButton}
            disabled={!taskDraft.title.trim() || busy === "newTask"}
            onClick={async () => {
              const ok = await call(
                "newTask",
                `/api/crm/contacts/${contactId}/tasks`,
                { body: JSON.stringify({ dueAt: taskDraft.dueAt ? `${taskDraft.dueAt}T09:00:00` : null, title: taskDraft.title }), method: "POST" },
                "No se pudo crear la tarea.",
              );
              if (ok) setTaskDraft({ dueAt: "", title: "" });
            }}
            type="button"
          >
            Añadir
          </button>
        </div>
      </Block>

      <Block title="Notas">
        <div className="grid gap-1.5">
          {card.notes.map((note) => (
            <div className="rounded-lg border border-[#e2e6df] p-2 text-sm" key={note.id}>
              <p className="whitespace-pre-line">{note.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-[#647067]">
                <span>{when(note.created_at)}</span>
                <button
                  aria-label="Borrar nota"
                  onClick={() => void call("note", `/api/crm/notes/${note.id}`, { method: "DELETE" }, "No se pudo borrar la nota.")}
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <textarea
          className="mt-2 min-h-16 w-full rounded-lg border border-[#cbd2c6] px-3 py-2 text-sm outline-none"
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Escribe una nota interna…"
          value={noteDraft}
        />
        <button
          className={`${smallButton} mt-1`}
          disabled={!noteDraft.trim() || busy === "newNote"}
          onClick={async () => {
            const ok = await call("newNote", `/api/crm/contacts/${contactId}/notes`, { body: JSON.stringify({ body: noteDraft }), method: "POST" }, "No se pudo guardar la nota.");
            if (ok) setNoteDraft("");
          }}
          type="button"
        >
          Guardar nota
        </button>
      </Block>

      <Block title="Actividad">
        <ol className="grid gap-1 text-xs">
          {card.activity.map((entry) => (
            <li className="flex gap-2" key={entry.id}>
              <span className="w-28 shrink-0 text-[#647067]">{when(entry.created_at)}</span>
              <span>
                <strong className="font-medium">{ACTIVITY_LABELS[entry.kind] ?? entry.kind}</strong>
                {activityDetail(entry) ? `: ${activityDetail(entry)}` : ""}
                <span className="text-[#9aa59e]"> · {ACTOR_LABELS[entry.actor] ?? entry.actor}</span>
              </span>
            </li>
          ))}
        </ol>
        {card.activity.length === 0 ? <p className="text-xs text-[#647067]">Sin actividad todavía.</p> : null}
      </Block>

      {canDelete ? (
        <Block title="Privacidad">
          <p className="text-xs text-[#647067]">
            Borra el contacto y todo lo suyo: conversaciones, mensajes, notas, tareas, citas y su copia en Google
            Calendar. No se puede deshacer.
          </p>
          <button
            className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
            disabled={busy === "delete"}
            onClick={async () => {
              const label = card.contact.full_name ?? card.contact.phone_e164;
              if (!window.confirm(`¿Borrar a ${label} y todos sus datos? No se puede deshacer.`)) return;
              setBusy("delete");
              const response = await fetch(`/api/crm/contacts/${contactId}`, { method: "DELETE" });
              setBusy("");
              if (!response.ok) {
                setError(await readApiError(response, "No se pudo borrar el contacto."));
                return;
              }
              onDeleted();
            }}
            type="button"
          >
            <Trash2 size={14} /> Borrar contacto (RGPD)
          </button>
        </Block>
      ) : null}
    </Shell>
  );
}

function Shell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#10231c]/35" onClick={onClose} role="dialog">
      <aside
        className="flex h-full w-full max-w-xl flex-col gap-3 overflow-y-auto bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-lg font-semibold">{title}</h3>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function Block({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-[#e2e6df] p-3">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </section>
  );
}
