"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns3,
  Download,
  List,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";

import { ContactDrawer } from "./contact-drawer";
import type { ContactListItem, CrmPanelOptions } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  import: "Importado",
  manual: "Manual",
  stripe: "Stripe",
  whatsapp: "WhatsApp",
};

const inputClass = "h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none";
const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium disabled:opacity-60";

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function TagChip({ color, name }: { color: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#e2e6df] bg-white px-1.5 py-0.5 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export function ContactsPanel({
  canManage,
  initial,
  options,
}: {
  /** owner/admin: importar, exportar y borrar (RGPD). */
  canManage: boolean;
  initial: { contacts: ContactListItem[]; total: number };
  options: CrmPanelOptions;
}) {
  const [view, setView] = useState<"kanban" | "list">("list");
  const [query, setQuery] = useState("");
  const [stageId, setStageId] = useState("");
  const [tagId, setTagId] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState(initial.contacts);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const firstLoad = useRef(true);
  const pageSize = view === "kanban" ? 100 : 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query.trim()) params.set("q", query.trim());
    if (stageId) params.set("stageId", stageId);
    if (tagId) params.set("tagId", tagId);
    if (source) params.set("source", source);

    const response = await fetch(`/api/crm/contacts?${params.toString()}`);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudieron cargar los contactos."));
    } else {
      const payload = (await response.json()) as { contacts: ContactListItem[]; total: number };
      setContacts(payload.contacts);
      setTotal(payload.total);
    }
    setLoading(false);
  }, [page, pageSize, query, source, stageId, tagId]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const byStage = useMemo(() => {
    const groups = new Map(options.stages.map((stage) => [stage.id, [] as ContactListItem[]]));
    for (const contact of contacts) {
      const id = contact.stage?.id;
      if (id && groups.has(id)) groups.get(id)!.push(contact);
    }
    return groups;
  }, [contacts, options.stages]);

  async function moveStage(contactId: string, nextStageId: string) {
    const response = await fetch(`/api/crm/contacts/${contactId}/stage`, {
      body: JSON.stringify({ stageId: nextStageId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo cambiar la etapa."));
      return;
    }
    await load();
  }

  async function importFile(file: File) {
    setNotice("");
    setError("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/crm/contacts/import", { body: form, method: "POST" });

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo importar el archivo."));
      return;
    }

    const result = (await response.json()) as { created: number; errors: string[]; skipped: number; updated: number };
    setNotice(
      `Importados: ${result.created} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos.${
        result.errors.length ? `\n${result.errors.slice(0, 10).join("\n")}` : ""
      }`,
    );
    await load();
  }

  return (
    <section className="rounded-lg border border-[#d9ded3] bg-white p-4" id="clients">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Clientes</h2>
          <p className="mt-1 text-sm text-[#647067]">
            Contactos de esta empresa: etapa, etiquetas, notas, tareas y citas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#cbd2c6] p-0.5">
            <button
              aria-pressed={view === "list"}
              className={`inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm ${view === "list" ? "bg-[#eef2eb] font-medium" : ""}`}
              onClick={() => {
                setView("list");
                setPage(1);
              }}
              type="button"
            >
              <List size={15} /> Lista
            </button>
            <button
              aria-pressed={view === "kanban"}
              className={`inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm ${view === "kanban" ? "bg-[#eef2eb] font-medium" : ""}`}
              onClick={() => {
                setView("kanban");
                setPage(1);
              }}
              type="button"
            >
              <Columns3 size={15} /> Etapas
            </button>
          </div>
          {canManage ? (
            <>
              <button
                className={secondaryButton}
                onClick={() => {
                  // Descarga de archivo: navegación directa, no una página.
                  window.location.href = "/api/crm/contacts/export";
                }}
                type="button"
              >
                <Download size={15} /> Exportar CSV
              </button>
              <button className={secondaryButton} onClick={() => fileInput.current?.click()} type="button">
                <Upload size={15} /> Importar CSV
              </button>
              <input
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
                ref={fileInput}
                type="file"
              />
            </>
          ) : null}
          <button className={primaryButton} onClick={() => setCreating(true)} type="button">
            <Plus size={15} /> Nuevo contacto
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_180px_150px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-[#9aa59e]" size={16} />
          <input
            aria-label="Buscar"
            className={`${inputClass} w-full pl-9`}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, teléfono, correo o empresa"
            value={query}
          />
        </label>
        <select aria-label="Etapa" className={inputClass} onChange={(event) => { setStageId(event.target.value); setPage(1); }} value={stageId}>
          <option value="">Todas las etapas</option>
          {options.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <select aria-label="Etiqueta" className={inputClass} onChange={(event) => { setTagId(event.target.value); setPage(1); }} value={tagId}>
          <option value="">Todas las etiquetas</option>
          {options.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <select aria-label="Origen" className={inputClass} onChange={(event) => { setSource(event.target.value); setPage(1); }} value={source}>
          <option value="">Todos los orígenes</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="mt-3 whitespace-pre-line rounded-lg border border-[#d9ded3] bg-[#fafbf8] p-3 text-sm">{notice}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-2 text-xs text-[#647067]">
        {loading ? <Loader2 className="animate-spin" size={13} /> : null}
        <span>{total} contacto(s)</span>
      </div>

      {view === "list" ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-[#647067]">
              <tr className="border-b border-[#e2e6df]">
                <th className="py-2 pr-3 font-medium">Contacto</th>
                <th className="py-2 pr-3 font-medium">Etapa</th>
                <th className="py-2 pr-3 font-medium">Etiquetas</th>
                <th className="py-2 pr-3 font-medium">Origen</th>
                <th className="py-2 font-medium">Último mensaje</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  className="cursor-pointer border-b border-[#eef0ec] hover:bg-[#fafbf8]"
                  key={contact.id}
                  onClick={() => setOpenContactId(contact.id)}
                >
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{contact.full_name ?? "Sin nombre"}</p>
                    <p className="text-xs text-[#647067]">
                      {contact.phone_e164}
                      {contact.company ? ` · ${contact.company}` : ""}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3">
                    {contact.stage ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="size-2 rounded-full" style={{ backgroundColor: contact.stage.color }} />
                        {contact.stage.name}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <TagChip color={tag.color} key={tag.id} name={tag.name} />
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{SOURCE_LABELS[contact.source ?? ""] ?? "—"}</td>
                  <td className="py-2.5 text-xs text-[#647067]">{formatWhen(contact.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {contacts.length === 0 && !loading ? (
            <p className="mt-3 rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              No hay contactos con estos filtros. Los que escriban por WhatsApp aparecerán aquí solos.
            </p>
          ) : null}
          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <button className={secondaryButton} disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">
                Anterior
              </button>
              <span className="text-[#647067]">
                Página {page} de {totalPages}
              </span>
              <button className={secondaryButton} disabled={page >= totalPages} onClick={() => setPage(page + 1)} type="button">
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {options.stages.map((stage) => {
            const column = byStage.get(stage.id) ?? [];
            return (
              <div className="flex min-h-40 flex-col rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-2" key={stage.id}>
                <p className="flex items-center gap-1.5 px-1 py-1 text-sm font-semibold">
                  <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                  <span className="ml-auto text-xs font-normal text-[#647067]">{column.length}</span>
                </p>
                <div className="mt-1 grid gap-2">
                  {column.map((contact) => (
                    <div className="rounded-lg border border-[#e2e6df] bg-white p-2 text-sm" key={contact.id}>
                      <button className="w-full text-left" onClick={() => setOpenContactId(contact.id)} type="button">
                        <p className="truncate font-semibold">{contact.full_name ?? "Sin nombre"}</p>
                        <p className="text-xs text-[#647067]">{contact.phone_e164}</p>
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <TagChip color={tag.color} key={tag.id} name={tag.name} />
                        ))}
                      </div>
                      <select
                        aria-label="Mover a etapa"
                        className="mt-2 h-8 w-full rounded-md border border-[#e2e6df] px-2 text-xs outline-none"
                        onChange={(event) => void moveStage(contact.id, event.target.value)}
                        value={stage.id}
                      >
                        {options.stages.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.id === stage.id ? `En ${option.name}` : `Mover a ${option.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {total > contacts.length ? (
            <p className="col-span-full text-xs text-[#647067]">
              Se muestran los {contacts.length} contactos más recientes. Usa los filtros para afinar.
            </p>
          ) : null}
        </div>
      )}

      {creating ? (
        <NewContactDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenContactId(id);
            void load();
          }}
          stages={options.stages}
        />
      ) : null}

      {openContactId ? (
        <ContactDrawer
          canDelete={canManage}
          contactId={openContactId}
          onChanged={() => void load()}
          onClose={() => setOpenContactId(null)}
          onDeleted={() => {
            setOpenContactId(null);
            void load();
          }}
          options={options}
        />
      ) : null}
    </section>
  );
}

function NewContactDialog({
  onClose,
  onCreated,
  stages,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  stages: CrmPanelOptions["stages"];
}) {
  const [form, setForm] = useState({ company: "", email: "", fullName: "", phone: "", stageId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/crm/contacts", {
      body: JSON.stringify({ ...form, stageId: form.stageId || null }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSaving(false);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo crear el contacto."));
      return;
    }

    onCreated(((await response.json()) as { contact: { id: string } }).contact.id);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10231c]/35 p-4 backdrop-blur-sm" role="dialog">
      <form className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl" onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Nuevo contacto</h3>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          <input className={inputClass} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Teléfono con prefijo (+34 600 000 000)" required value={form.phone} />
          <input className={inputClass} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nombre" value={form.fullName} />
          <input className={inputClass} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Correo" type="email" value={form.email} />
          <input className={inputClass} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Empresa" value={form.company} />
          <select className={inputClass} onChange={(event) => setForm({ ...form, stageId: event.target.value })} value={form.stageId}>
            <option value="">Etapa: la primera</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className={secondaryButton} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className={primaryButton} disabled={saving} type="submit">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            Crear
          </button>
        </div>
      </form>
    </div>
  );
}
