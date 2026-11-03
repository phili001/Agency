"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";

import type { CrmFieldOption, CrmStageOption, CrmTagOption } from "./types";

/**
 * Ajustes del CRM (owner/admin): etapas del embudo (orden, nombre, color,
 * tipo), etiquetas y campos personalizados. Vive dentro de Clientes.
 */

const inputClass = "h-9 rounded-lg border border-[#cbd2c6] bg-white px-2.5 text-sm outline-none";
const smallButton =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-[#cbd2c6] bg-white px-2.5 text-sm font-medium disabled:opacity-60";

const KIND_LABELS: Record<CrmStageOption["kind"], string> = { lost: "Perdido", open: "Abierta", won: "Ganado" };
const FIELD_TYPES: Array<[string, string]> = [
  ["text", "Texto corto"],
  ["long_text", "Texto largo"],
  ["number", "Número"],
  ["money", "Dinero"],
  ["date", "Fecha"],
  ["boolean", "Sí / No"],
  ["select", "Una opción"],
  ["multi", "Varias opciones"],
  ["phone", "Teléfono"],
  ["email", "Correo"],
  ["url", "Enlace"],
];

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    method,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "No se pudo guardar."));
  }
  return response.json();
}

export function CrmSettings({
  initialFields,
  initialStages,
  initialTags,
  onChanged,
}: {
  initialFields: CrmFieldOption[];
  initialStages: CrmStageOption[];
  initialTags: CrmTagOption[];
  onChanged: () => void;
}) {
  const [stages, setStages] = useState(initialStages);
  const [tags, setTags] = useState(initialTags);
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [newStage, setNewStage] = useState("");
  const [newTag, setNewTag] = useState({ color: "#64748b", name: "" });
  const [newField, setNewField] = useState({ label: "", options: "", type: "text" });

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await action();
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo guardar.");
    }
    setBusy("");
  }

  function moveStage(index: number, delta: number) {
    const next = [...stages];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    void run("order", async () => {
      const payload = (await send("/api/crm/stages", "PUT", { ids: next.map((stage) => stage.id) })) as { stages: CrmStageOption[] };
      setStages(payload.stages);
    });
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <section>
        <h3 className="text-sm font-semibold">Etapas del embudo</h3>
        <p className="text-xs text-[#647067]">Los contactos sin etapa están en la primera «Abierta».</p>
        <div className="mt-2 grid gap-1.5">
          {stages.map((stage, index) => (
            <div className="grid grid-cols-[auto_1fr_120px_auto] items-center gap-2" key={stage.id}>
              <input
                aria-label="Color"
                className="size-9 rounded-lg border border-[#cbd2c6]"
                defaultValue={stage.color}
                onBlur={(event) =>
                  event.target.value !== stage.color &&
                  void run(`s-${stage.id}`, async () => {
                    const { stage: saved } = (await send(`/api/crm/stages/${stage.id}`, "PATCH", { color: event.target.value })) as { stage: CrmStageOption };
                    setStages(stages.map((item) => (item.id === saved.id ? saved : item)));
                  })
                }
                type="color"
              />
              <input
                aria-label="Nombre"
                className={inputClass}
                defaultValue={stage.name}
                onBlur={(event) =>
                  event.target.value.trim() !== stage.name &&
                  void run(`s-${stage.id}`, async () => {
                    const { stage: saved } = (await send(`/api/crm/stages/${stage.id}`, "PATCH", { name: event.target.value })) as { stage: CrmStageOption };
                    setStages(stages.map((item) => (item.id === saved.id ? saved : item)));
                  })
                }
              />
              <select
                aria-label="Tipo"
                className={inputClass}
                onChange={(event) =>
                  void run(`s-${stage.id}`, async () => {
                    const { stage: saved } = (await send(`/api/crm/stages/${stage.id}`, "PATCH", { kind: event.target.value })) as { stage: CrmStageOption };
                    setStages(stages.map((item) => (item.id === saved.id ? saved : item)));
                  })
                }
                value={stage.kind}
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button aria-label="Subir" className={smallButton} disabled={index === 0 || busy === "order"} onClick={() => moveStage(index, -1)} type="button">
                  <ArrowUp size={14} />
                </button>
                <button aria-label="Bajar" className={smallButton} disabled={index === stages.length - 1 || busy === "order"} onClick={() => moveStage(index, 1)} type="button">
                  <ArrowDown size={14} />
                </button>
                <button
                  aria-label="Borrar etapa"
                  className={`${smallButton} text-red-700`}
                  onClick={() => {
                    if (!window.confirm(`¿Borrar la etapa «${stage.name}»? Sus contactos pasan a la primera etapa abierta.`)) return;
                    void run(`s-${stage.id}`, async () => {
                      await send(`/api/crm/stages/${stage.id}`, "DELETE");
                      setStages(stages.filter((item) => item.id !== stage.id));
                    });
                  }}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={`${inputClass} flex-1`} onChange={(event) => setNewStage(event.target.value)} placeholder="Nueva etapa" value={newStage} />
          <button
            className={smallButton}
            disabled={!newStage.trim() || busy === "newStage"}
            onClick={() =>
              void run("newStage", async () => {
                const { stage } = (await send("/api/crm/stages", "POST", { name: newStage })) as { stage: CrmStageOption };
                setStages([...stages, stage]);
                setNewStage("");
              })
            }
            type="button"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Etiquetas</h3>
        <p className="text-xs text-[#647067]">Ponerle una etiqueta a un contacto puede lanzar un flujo (disparador «Tag»).</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#e2e6df] px-2 py-1 text-sm" key={tag.id}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
              <button
                aria-label={`Borrar ${tag.name}`}
                onClick={() => {
                  if (!window.confirm(`¿Borrar la etiqueta «${tag.name}»? Se quita de todos los contactos.`)) return;
                  void run(`t-${tag.id}`, async () => {
                    await send(`/api/crm/tags/${tag.id}`, "DELETE");
                    setTags(tags.filter((item) => item.id !== tag.id));
                  });
                }}
                type="button"
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
          {tags.length === 0 ? <span className="text-xs text-[#647067]">Aún no hay etiquetas.</span> : null}
        </div>
        <div className="mt-2 flex gap-2">
          <input aria-label="Color" className="size-9 rounded-lg border border-[#cbd2c6]" onChange={(event) => setNewTag({ ...newTag, color: event.target.value })} type="color" value={newTag.color} />
          <input className={`${inputClass} flex-1`} onChange={(event) => setNewTag({ ...newTag, name: event.target.value })} placeholder="Nueva etiqueta" value={newTag.name} />
          <button
            className={smallButton}
            disabled={!newTag.name.trim() || busy === "newTag"}
            onClick={() =>
              void run("newTag", async () => {
                const { tag } = (await send("/api/crm/tags", "POST", newTag)) as { tag: CrmTagOption };
                setTags([...tags, tag].sort((a, b) => a.name.localeCompare(b.name)));
                setNewTag({ color: "#64748b", name: "" });
              })
            }
            type="button"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Campos personalizados</h3>
        <p className="text-xs text-[#647067]">
          Datos propios de tu negocio en cada ficha. Marca «La IA lo puede leer» solo si el agente lo necesita para atender.
        </p>
        <div className="mt-2 grid gap-1.5">
          {fields.map((field) => (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e6df] p-2 text-sm" key={field.id}>
              <span className={`font-medium ${field.active ? "" : "text-[#9aa59e] line-through"}`}>{field.label}</span>
              <span className="text-xs text-[#647067]">
                {FIELD_TYPES.find(([value]) => value === field.type)?.[1] ?? field.type} · {field.key}
              </span>
              <label className="ml-auto inline-flex items-center gap-1 text-xs">
                <input
                  checked={field.ai_readable}
                  onChange={(event) =>
                    void run(`f-${field.id}`, async () => {
                      const { field: saved } = (await send(`/api/crm/fields/${field.id}`, "PATCH", { aiReadable: event.target.checked })) as { field: CrmFieldOption };
                      setFields(fields.map((item) => (item.id === saved.id ? saved : item)));
                    })
                  }
                  type="checkbox"
                />
                La IA lo puede leer
              </label>
              <button
                className={smallButton}
                onClick={() =>
                  void run(`f-${field.id}`, async () => {
                    const { field: saved } = (await send(`/api/crm/fields/${field.id}`, "PATCH", { active: !field.active })) as { field: CrmFieldOption };
                    setFields(fields.map((item) => (item.id === saved.id ? saved : item)));
                  })
                }
                type="button"
              >
                {field.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto]">
          <input className={inputClass} onChange={(event) => setNewField({ ...newField, label: event.target.value })} placeholder="Nombre del campo" value={newField.label} />
          <select className={inputClass} onChange={(event) => setNewField({ ...newField, type: event.target.value })} value={newField.type}>
            {FIELD_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            disabled={newField.type !== "select" && newField.type !== "multi"}
            onChange={(event) => setNewField({ ...newField, options: event.target.value })}
            placeholder="Opciones, separadas por comas"
            value={newField.options}
          />
          <button
            className={smallButton}
            disabled={!newField.label.trim() || busy === "newField"}
            onClick={() =>
              void run("newField", async () => {
                const { field } = (await send("/api/crm/fields", "POST", {
                  label: newField.label,
                  options: newField.options.split(",").map((item) => item.trim()).filter(Boolean),
                  type: newField.type,
                })) as { field: CrmFieldOption };
                setFields([...fields, field]);
                setNewField({ label: "", options: "", type: "text" });
              })
            }
            type="button"
          >
            {busy === "newField" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Añadir
          </button>
        </div>
      </section>
    </div>
  );
}
