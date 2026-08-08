"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Clock3,
  GitBranch,
  Loader2,
  MessageSquareText,
  Plus,
  Save,
  Trash2,
  UserRound,
  Workflow,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

import {
  createBlankStep,
  defaultFlowStages,
  flowStepTypes,
  parseFlowSteps,
  type FlowGhlAction,
  type FlowAudience,
  type FlowRecord,
  type FlowStatus,
  type FlowStep,
  type FlowStepType,
  type FlowTriggerType,
  type FlowStage,
} from "@/lib/flow-definitions";
import type { Json } from "@/lib/supabase/database.types";

type AgentItem = {
  id: string;
  is_active: boolean;
  name: string;
};

type FlowRunItem = {
  flow_id: string;
  status: string;
};

type IntegrationItem = {
  config: Json;
  provider: "gohighlevel" | "openai" | "ycloud";
  status: string;
};

type FlowBuilderProps = {
  agents: AgentItem[];
  flows: FlowRecord[];
  integrations: IntegrationItem[];
  runs: FlowRunItem[];
  workspaceCode?: string | null;
  workspaceId: string | null;
};

const statuses: Array<{ label: string; value: FlowStatus }> = [
  { label: "Borrador", value: "draft" },
  { label: "Activo", value: "active" },
  { label: "Pausado", value: "paused" },
];

const triggers: Array<{ label: string; value: FlowTriggerType }> = [
  { label: "Primer mensaje inbound", value: "first_inbound" },
  { label: "Palabra clave", value: "keyword" },
  { label: "Tag", value: "tag" },
  { label: "Webhook GHL", value: "webhook" },
  { label: "Manual", value: "manual" },
];

const ghlActionTypes: Array<{ label: string; value: FlowGhlAction["type"] }> = [
  { label: "Aplicar tag", value: "add_tag" },
  { label: "Quitar tag", value: "remove_tag" },
  { label: "Actualizar campo", value: "update_contact_field" },
  { label: "Mover oportunidad", value: "upsert_opportunity" },
  { label: "Crear tarea", value: "create_task" },
  { label: "Cambiar calendario de citas", value: "set_booking_calendar" },
];

function asConfigRecord(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")]),
  );
}

function getFlowCounts(runs: FlowRunItem[], flowId: string) {
  const flowRuns = runs.filter((run) => run.flow_id === flowId);

  return {
    active: flowRuns.filter((run) => ["active", "waiting"].includes(run.status)).length,
    completed: flowRuns.filter((run) => run.status === "completed").length,
    transferred: flowRuns.filter((run) => run.status === "transferred").length,
  };
}

function normalizeFlow(flow: FlowRecord): FlowRecord {
  return {
    ...flow,
    steps: parseFlowSteps(flow.steps as Json).map((step, index) => ({
      ...step,
      stageKey:
        step.stageKey ??
        (index === 0
          ? "inicio"
          : step.type === "agent" || step.type === "human" || step.type === "finish"
            ? "cierre"
            : "diagnostico"),
    })),
    trigger_config: flow.trigger_config ?? {},
  };
}

function getStageLabel(stageKey?: string) {
  return defaultFlowStages.find((stage) => stage.key === stageKey)?.label ?? "Sin etapa";
}

function getFlowStages(flow?: FlowRecord | null): FlowStage[] {
  const configuredStages = flow?.trigger_config?.stages;

  if (!Array.isArray(configuredStages)) {
    return defaultFlowStages;
  }

  const customStages = configuredStages.filter(
    (stage): stage is FlowStage =>
      Boolean(stage) &&
      typeof stage === "object" &&
      !Array.isArray(stage) &&
      typeof (stage as Record<string, unknown>).key === "string" &&
      typeof (stage as Record<string, unknown>).label === "string" &&
      typeof (stage as Record<string, unknown>).description === "string",
  );

  return customStages.length > 0 ? customStages : defaultFlowStages;
}

function orderAndLinkPipelineSteps(steps: FlowStep[], stages: FlowStage[]) {
  const stageOrder = new Map(stages.map((stage, index) => [stage.key, index]));
  const ordered = steps
    .map((step, index) => ({ index, step }))
    .sort((left, right) => {
      const leftStage = stageOrder.get(left.step.stageKey ?? "inicio") ?? stages.length;
      const rightStage = stageOrder.get(right.step.stageKey ?? "inicio") ?? stages.length;
      return leftStage === rightStage ? left.index - right.index : leftStage - rightStage;
    })
    .map(({ step }) => step);

  return ordered.map((step, index) => ({
    ...step,
    nextStepId:
      step.type === "agent" || step.type === "finish" || step.type === "human"
        ? undefined
        : ordered[index + 1]?.id,
  }));
}

function TriggerConfigEditor({
  flow,
  onChange,
}: {
  flow: FlowRecord;
  onChange: (patch: Partial<FlowRecord>) => void;
}) {
  const triggerConfig = flow.trigger_config ?? {};
  const audience = String(triggerConfig.audience ?? "all") as FlowAudience;
  let triggerDetail: React.ReactNode = null;

  if (flow.trigger_type === "keyword") {
    triggerDetail = (
      <label className="grid gap-1.5 text-sm font-medium">
        Palabra clave
        <input
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
          onChange={(event) =>
            onChange({
              trigger_config: { ...triggerConfig, keyword: event.target.value },
            })
          }
          placeholder="Ej: quiero automatizar"
          value={String(triggerConfig.keyword ?? "")}
        />
      </label>
    );
  }

  if (flow.trigger_type === "webhook") {
    triggerDetail = (
      <label className="grid gap-1.5 text-sm font-medium">
        Clave externa
        <input
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
          onChange={(event) =>
            onChange({
              trigger_config: { ...triggerConfig, flowKey: event.target.value },
            })
          }
          placeholder="Ej: onboarding_levy"
          value={String(triggerConfig.flowKey ?? "")}
        />
      </label>
    );
  }

  if (flow.trigger_type === "tag") {
    triggerDetail = (
      <label className="grid gap-1.5 text-sm font-medium">
        Tag disparador
        <input
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
          onChange={(event) =>
            onChange({ trigger_config: { ...triggerConfig, tag: event.target.value } })
          }
          placeholder="Ej: levy_inbound"
          value={String(triggerConfig.tag ?? "")}
        />
      </label>
    );
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Quien entra
        <select
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
          onChange={(event) => {
            const nextAudience = event.target.value as FlowAudience;
            onChange({
              trigger_config: {
                ...triggerConfig,
                audience: nextAudience,
                ...(nextAudience === "new_contacts"
                  ? {
                      excludedLabels: ["onboarding_excluded_existing"],
                      requiredLabels: ["onboarding_eligible"],
                    }
                  : {}),
              },
            });
          }}
          value={audience}
        >
          <option value="new_contacts">Solo contactos nuevos</option>
          <option value="labels">Contactos con etiquetas</option>
          <option value="all">Todos los contactos</option>
          <option value="manual">Activacion manual</option>
        </select>
      </label>
      {audience === "labels" ? (
        <label className="grid gap-1.5 text-sm font-medium">
          Etiquetas requeridas
          <input
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
            onChange={(event) =>
              onChange({
                trigger_config: {
                  ...triggerConfig,
                  requiredLabels: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="onboarding_eligible, lead_calificado"
            value={
              Array.isArray(triggerConfig.requiredLabels)
                ? triggerConfig.requiredLabels.join(", ")
                : ""
            }
          />
        </label>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input
          checked={triggerConfig.allowRepeat === true}
          className="mt-0.5 h-4 w-4 accent-[#35735b]"
          onChange={(event) =>
            onChange({
              trigger_config: {
                ...triggerConfig,
                allowRepeat: event.target.checked,
              },
            })
          }
          type="checkbox"
        />
        <span>
          <span className="block font-semibold">Permitir repetir flujo</span>
          <span className="block text-xs text-[#647067]">
            Desactivado evita que un contacto terminado vuelva al onboarding.
          </span>
        </span>
      </label>
      {triggerDetail}
    </div>
  );
}

function GhlActionsEditor({
  actions,
  calendars,
  onChange,
}: {
  actions: FlowGhlAction[];
  calendars: Array<{ id: string; name: string }>;
  onChange: (actions: FlowGhlAction[]) => void;
}) {
  function patchAction(index: number, patch: Partial<FlowGhlAction>) {
    onChange(
      actions.map((action, actionIndex) =>
        actionIndex === index ? ({ ...action, ...patch } as FlowGhlAction) : action,
      ),
    );
  }

  return (
    <div className="rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Acciones GHL al ejecutar</p>
        <button
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cbd2c6] bg-white px-2 text-xs font-medium"
          onClick={() =>
            onChange([
              ...actions,
              { label: "Nueva accion", tag: "", type: "add_tag" },
            ])
          }
          type="button"
        >
          <Plus size={13} />
          Accion
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {actions.map((action, index) => (
          <div className="grid gap-2 rounded-lg border border-[#e2e6df] bg-white p-3" key={index}>
            <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
              <input
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => patchAction(index, { label: event.target.value })}
                placeholder="Nombre visible"
                value={action.label ?? ""}
              />
              <select
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) =>
                  patchAction(index, {
                    type: event.target.value as FlowGhlAction["type"],
                  })
                }
                value={action.type}
              >
                {ghlActionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-2 text-red-700"
                onClick={() => onChange(actions.filter((_, actionIndex) => actionIndex !== index))}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {["add_tag", "remove_tag"].includes(action.type) ? (
              <input
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => patchAction(index, { tag: event.target.value })}
                placeholder="Tag GHL. Ej: levy_calificado"
                value={"tag" in action ? action.tag ?? "" : ""}
              />
            ) : null}
            {action.type === "update_contact_field" ? (
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                  onChange={(event) =>
                    patchAction(index, { customFieldKey: event.target.value })
                  }
                  placeholder="ID o key del custom field"
                  value={"customFieldKey" in action ? action.customFieldKey ?? "" : ""}
                />
                <input
                  className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                  onChange={(event) =>
                    patchAction(index, { customFieldValue: event.target.value })
                  }
                  placeholder="Valor o {{campo}}"
                  value={"customFieldValue" in action ? action.customFieldValue ?? "" : ""}
                />
              </div>
            ) : null}
            {action.type === "upsert_opportunity" ? (
              <div className="grid gap-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                    onChange={(event) => patchAction(index, { pipelineId: event.target.value })}
                    placeholder="Pipeline ID de GoHighLevel"
                    value={"pipelineId" in action ? action.pipelineId ?? "" : ""}
                  />
                  <input
                    className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                    onChange={(event) => patchAction(index, { stageId: event.target.value })}
                    placeholder="Stage ID de GoHighLevel"
                    value={"stageId" in action ? action.stageId ?? "" : ""}
                  />
                </div>
                <p className="text-xs text-[#647067]">
                  Los IDs salen de GoHighLevel: Opportunities &gt; Pipelines. Cada
                  pipeline y cada etapa tienen su propio ID.
                </p>
              </div>
            ) : null}
            {action.type === "create_task" ? (
              <input
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) => patchAction(index, { taskTitle: event.target.value })}
                placeholder="Titulo de tarea"
                value={"taskTitle" in action ? action.taskTitle ?? "" : ""}
              />
            ) : null}
            {action.type === "set_booking_calendar" ? (
              <div className="grid gap-2">
                <select
                  className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none disabled:bg-[#f2f4f0] disabled:text-[#9aa59e]"
                  disabled={calendars.length === 0}
                  onChange={(event) =>
                    patchAction(index, { calendarId: event.target.value })
                  }
                  value={"calendarId" in action ? action.calendarId ?? "" : ""}
                >
                  <option value="">
                    {calendars.length === 0
                      ? "Conecta GoHighLevel para ver calendarios"
                      : "Elige un calendario"}
                  </option>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#647067]">
                  A partir de aqui, el agente de citas agenda a este contacto en
                  este calendario en vez del de por defecto de Tools.
                </p>
              </div>
            ) : null}
          </div>
        ))}
        {actions.length === 0 ? (
          <p className="text-xs text-[#647067]">
            Puedes dejar el paso sin acciones o sincronizar tags, campos y etapas en GHL.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StepEditor({
  agents,
  calendars,
  flowStages,
  onChange,
  onDelete,
  onMoveDown,
  onMoveUp,
  step,
  stepOptions,
  canMoveDown,
  canMoveUp,
}: {
  agents: AgentItem[];
  calendars: Array<{ id: string; name: string }>;
  flowStages: FlowStage[];
  onChange: (step: FlowStep) => void;
  onDelete: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  step: FlowStep;
  stepOptions: FlowStep[];
  canMoveDown: boolean;
  canMoveUp: boolean;
}) {
  const stepType = flowStepTypes.find((type) => type.value === step.type);
  const stageLabel =
    flowStages.find((stage) => stage.key === step.stageKey)?.label ??
    getStageLabel(step.stageKey);

  return (
    <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-[#647067]">
            {stageLabel}
          </p>
          <h3 className="text-base font-semibold">Configuracion del paso</h3>
        </div>
        <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
          {stepType?.label ?? step.type}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto_auto]">
        <input
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm font-semibold outline-none"
          onChange={(event) => onChange({ ...step, name: event.target.value })}
          value={step.name}
        />
        <select
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
          onChange={(event) =>
            onChange({ ...step, type: event.target.value as FlowStepType })
          }
          value={step.type}
        >
          {flowStepTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium disabled:opacity-40"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          title="Subir paso"
          type="button"
        >
          <ArrowUp size={15} />
        </button>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium disabled:opacity-40"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          title="Bajar paso"
          type="button"
        >
          <ArrowDown size={15} />
        </button>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700"
          onClick={onDelete}
          type="button"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <p className="mt-2 text-xs text-[#647067]">{stepType?.description}</p>

      <div className="mt-3 grid gap-2 rounded-lg border border-[#d9ded3] bg-[#fafbf8] p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            checked={step.requiredForStage !== false}
            className="mt-0.5 h-4 w-4 accent-[#35735b]"
            onChange={(event) =>
              onChange({ ...step, requiredForStage: event.target.checked })
            }
            type="checkbox"
          />
          <span>
            <span className="block font-semibold">Requisito para avanzar de etapa</span>
            <span className="block text-xs text-[#647067]">
              El cliente no completa esta etapa hasta que este paso tenga check.
            </span>
          </span>
        </label>
        {step.type === "message" ? (
          <label className="flex items-start gap-2 border-t border-[#e2e6df] pt-2 text-sm">
            <input
              checked={step.waitForInbound !== false}
              className="mt-0.5 h-4 w-4 accent-[#35735b]"
              onChange={(event) =>
                onChange({ ...step, waitForInbound: event.target.checked })
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold">
                Esperar que el cliente vuelva a escribir
              </span>
              <span className="block text-xs text-[#647067]">
                Envia este mensaje, marca el check y continua el siguiente paso con
                el proximo mensaje del cliente.
              </span>
            </span>
          </label>
        ) : null}
      </div>

      <label className="mt-3 grid gap-1.5 text-sm font-medium">
        Etapa del pipeline
        <select
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
          onChange={(event) => onChange({ ...step, stageKey: event.target.value })}
          value={step.stageKey ?? "inicio"}
        >
          {flowStages.map((stage) => (
            <option key={stage.key} value={stage.key}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>

      {["message", "options", "question"].includes(step.type) ? (
        <label className="mt-3 grid gap-1.5 text-sm font-medium">
          Mensaje WhatsApp
          <textarea
            className="min-h-28 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none"
            onChange={(event) => onChange({ ...step, message: event.target.value })}
            value={step.message ?? ""}
          />
        </label>
      ) : null}

      {["options", "question"].includes(step.type) ? (
        <label className="mt-3 grid gap-1.5 text-sm font-medium">
          Guardar respuesta en campo LEVY
          <input
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
            onChange={(event) => onChange({ ...step, fieldKey: event.target.value })}
            placeholder="Ej: tipo_negocio"
            value={step.fieldKey ?? ""}
          />
        </label>
      ) : null}

      {step.type === "options" ? (
        <div className="mt-3 grid gap-2 rounded-lg border border-[#d9ded3] bg-[#fafbf8] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Opciones de WhatsApp</p>
              <p className="text-xs text-[#647067]">
                Hasta tres se muestran como botones; cuatro o mas, como lista seleccionable.
              </p>
            </div>
            <button
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cbd2c6] bg-white px-2 text-xs font-medium"
              onClick={() => {
                const optionNumber = (step.options?.length ?? 0) + 1;
                onChange({
                  ...step,
                  options: [
                    ...(step.options ?? []),
                    {
                      label: `Opcion ${optionNumber}`,
                      value: `opcion_${optionNumber}`,
                    },
                  ],
                });
              }}
              type="button"
            >
              <Plus size={13} />
              Opcion
            </button>
          </div>
          {(step.options ?? []).map((option, optionIndex) => (
            <div
              className="grid gap-2 rounded-lg border border-[#e2e6df] bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
              key={`${option.value}-${optionIndex}`}
            >
              <input
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) =>
                  onChange({
                    ...step,
                    options: (step.options ?? []).map((item, index) =>
                      index === optionIndex ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
                placeholder="Texto visible"
                value={option.label}
              />
              <input
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) =>
                  onChange({
                    ...step,
                    options: (step.options ?? []).map((item, index) =>
                      index === optionIndex ? { ...item, value: event.target.value } : item,
                    ),
                  })
                }
                placeholder="Valor guardado"
                value={option.value}
              />
              <select
                className="h-9 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
                onChange={(event) =>
                  onChange({
                    ...step,
                    options: (step.options ?? []).map((item, index) =>
                      index === optionIndex
                        ? { ...item, nextStepId: event.target.value || undefined }
                        : item,
                    ),
                  })
                }
                value={option.nextStepId ?? ""}
              >
                <option value="">Siguiente general</option>
                {stepOptions
                  .filter((item) => item.id !== step.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <button
                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-2 text-red-700"
                onClick={() =>
                  onChange({
                    ...step,
                    options: (step.options ?? []).filter((_, index) => index !== optionIndex),
                  })
                }
                title="Eliminar opcion"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {step.type === "question" ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-[#b9d3c3] bg-[#f3f8ed] p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              checked={step.validationEnabled !== false}
              className="mt-0.5 h-4 w-4 accent-[#35735b]"
              onChange={(event) =>
                onChange({ ...step, validationEnabled: event.target.checked })
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold">Verificar respuesta con IA</span>
              <span className="block text-xs text-[#647067]">
                Solo una respuesta aprobada guarda el campo y completa el check.
              </span>
            </span>
          </label>
          {step.validationEnabled !== false ? (
            <>
              <label className="grid gap-1.5 text-sm font-medium">
                Criterio esperado
                <textarea
                  className="min-h-20 rounded-lg border border-[#cbd2c6] bg-white p-3 text-sm outline-none"
                  onChange={(event) =>
                    onChange({ ...step, validationCriteria: event.target.value })
                  }
                  placeholder="Que informacion debe contener para considerarse completa."
                  value={step.validationCriteria ?? ""}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Mensaje cuando no pasa
                <textarea
                  className="min-h-20 rounded-lg border border-[#cbd2c6] bg-white p-3 text-sm outline-none"
                  onChange={(event) =>
                    onChange({ ...step, retryMessage: event.target.value })
                  }
                  value={step.retryMessage ?? ""}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Minimo de caracteres utiles
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 outline-none"
                  min={1}
                  onChange={(event) =>
                    onChange({
                      ...step,
                      validationMinLength: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={step.validationMinLength ?? 3}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {step.type === "wait" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Cantidad
            <input
              className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
              min={1}
              onChange={(event) =>
                onChange({ ...step, waitAmount: Number(event.target.value) })
              }
              type="number"
              value={step.waitAmount ?? 1}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Unidad
            <select
              className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
              onChange={(event) =>
                onChange({
                  ...step,
                  waitUnit: event.target.value as FlowStep["waitUnit"],
                })
              }
              value={step.waitUnit ?? "hours"}
            >
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </label>
        </div>
      ) : null}

      {step.type === "agent" ? (
        <label className="mt-3 grid gap-1.5 text-sm font-medium">
          Agente destino opcional
          <select
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
            onChange={(event) => onChange({ ...step, agentId: event.target.value })}
            value={step.agentId ?? ""}
          >
            <option value="">Router automatico</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {step.type === "webhook" ? (
        <label className="mt-3 grid gap-1.5 text-sm font-medium">
          URL webhook externo
          <input
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
            onChange={(event) => onChange({ ...step, webhookUrl: event.target.value })}
            placeholder="https://..."
            value={step.webhookUrl ?? ""}
          />
        </label>
      ) : null}

      {step.type !== "finish" && step.type !== "human" && step.type !== "agent" ? (
        <label className="mt-3 grid gap-1.5 text-sm font-medium">
          Siguiente paso
          <select
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none"
            onChange={(event) =>
              onChange({ ...step, nextStepId: event.target.value || undefined })
            }
            value={step.nextStepId ?? ""}
          >
            <option value="">Siguiente en orden</option>
            {stepOptions
              .filter((option) => option.id !== step.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      <div className="mt-3">
        <GhlActionsEditor
          actions={step.actions ?? []}
          calendars={calendars}
          onChange={(actions) => onChange({ ...step, actions })}
        />
      </div>
    </div>
  );
}

export function FlowBuilder({
  agents,
  flows,
  integrations,
  runs,
  workspaceCode,
  workspaceId,
}: FlowBuilderProps) {
  const normalizedFlows = useMemo(() => flows.map(normalizeFlow), [flows]);
  const [localFlows, setLocalFlows] = useState(normalizedFlows);
  const [selectedFlowId, setSelectedFlowId] = useState(normalizedFlows[0]?.id ?? "");
  const selectedFlow =
    localFlows.find((flow) => flow.id === selectedFlowId) ?? localFlows[0] ?? null;
  const [draft, setDraft] = useState<FlowRecord | null>(selectedFlow);
  const [selectedStepId, setSelectedStepId] = useState(selectedFlow?.steps[0]?.id ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState("");
  const ghlConfig = asConfigRecord(
    integrations.find((integration) => integration.provider === "gohighlevel")?.config ?? {},
  );
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const activeFlows = localFlows.filter((flow) => flow.status === "active").length;
  const ghlActive = integrations.some(
    (integration) =>
      integration.provider === "gohighlevel" && integration.status === "active",
  );

  useEffect(() => {
    if (!workspaceId || !ghlActive) {
      return;
    }

    let cancelled = false;

    async function loadCalendars() {
      const response = await fetch(
        `/api/integrations/gohighlevel/calendars?workspaceId=${encodeURIComponent(
          workspaceId!,
        )}`,
      );

      if (!response.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as {
        calendars?: Array<{ id: string; name: string }>;
      };

      if (!cancelled) {
        setCalendars(payload.calendars ?? []);
      }
    }

    void loadCalendars();

    return () => {
      cancelled = true;
    };
  }, [ghlActive, workspaceId]);

  function updateDraft(patch: Partial<FlowRecord>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateStep(index: number, step: FlowStep) {
    updateDraft({
      steps: draft?.steps.map((item, itemIndex) => (itemIndex === index ? step : item)) ?? [],
    });
    setSelectedStepId(step.id);
  }

  async function saveFlow(nextStatus?: FlowStatus) {
    if (!workspaceId || !draft) {
      return;
    }

    setSaving("save");
    const pipelineSteps = orderAndLinkPipelineSteps(draft.steps, getFlowStages(draft));
    const response = await fetch("/api/flows", {
      body: JSON.stringify({
        action: "save",
        description: draft.description,
        flowId: draft.id.startsWith("local-") ? undefined : draft.id,
        name: draft.name,
        status: nextStatus ?? draft.status,
        steps: pipelineSteps,
        triggerConfig: draft.trigger_config,
        triggerType: draft.trigger_type,
        workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; flow?: FlowRecord };

    if (!response.ok || !payload.flow) {
      setStatus(payload.error ?? "No se pudo guardar el flujo.");
      setSaving("");
      return;
    }

    const saved = normalizeFlow(payload.flow);
    setLocalFlows((current) => {
      const without = current.filter((flow) => flow.id !== draft.id && flow.id !== saved.id);
      return [saved, ...without];
    });
    setSelectedFlowId(saved.id);
    setDraft(saved);
    setSelectedStepId(saved.steps[0]?.id ?? "");
    setStatus("Flujo guardado.");
    setSaving("");
  }

  async function createTemplate() {
    if (!workspaceId) {
      return;
    }

    if (localFlows.length > 0) {
      const existing = localFlows[0];
      setSelectedFlowId(existing.id);
      setDraft(existing);
      setSelectedStepId(existing.steps[0]?.id ?? "");
      setStatus("Por ahora solo se permite un flujo por empresa. Archiva el actual para crear otro.");
      return;
    }

    setSaving("template");
    const response = await fetch("/api/flows", {
      body: JSON.stringify({
        action: "create_levy_template",
        workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; flow?: FlowRecord };

    if (!response.ok || !payload.flow) {
      setStatus(payload.error ?? "No se pudo crear la plantilla.");
      setSaving("");
      return;
    }

    const created = normalizeFlow(payload.flow);
    setLocalFlows((current) => [created, ...current]);
    setSelectedFlowId(created.id);
    setDraft(created);
    setSelectedStepId(created.steps[0]?.id ?? "");
    setStatus("Plantilla LEVY creada en borrador.");
    setSaving("");
  }

  async function archiveFlow() {
    if (!workspaceId || !draft || draft.id.startsWith("local-")) {
      setLocalFlows((current) => current.filter((flow) => flow.id !== draft?.id));
      setSelectedFlowId("");
      setDraft(null);
      return;
    }

    const confirmed = window.confirm(`Archivar "${draft.name}"? El flujo dejara de ejecutarse.`);

    if (!confirmed) {
      return;
    }

    setSaving("archive");
    const response = await fetch("/api/flows", {
      body: JSON.stringify({
        action: "delete",
        flowId: draft.id,
        workspaceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo archivar el flujo.");
      setSaving("");
      return;
    }

    const remaining = localFlows.filter((flow) => flow.id !== draft.id);
    setLocalFlows(remaining);
    setSelectedFlowId(remaining[0]?.id ?? "");
    setDraft(remaining[0] ?? null);
    setSelectedStepId(remaining[0]?.steps[0]?.id ?? "");
    setStatus("Flujo archivado.");
    setSaving("");
  }

  function createEmptyFlow() {
    if (localFlows.length > 0) {
      const existing = localFlows[0];
      setSelectedFlowId(existing.id);
      setDraft(existing);
      setSelectedStepId(existing.steps[0]?.id ?? "");
      setStatus("Por ahora solo se permite un flujo por empresa. Archiva el actual para crear otro.");
      return;
    }

    const empty: FlowRecord = {
      description: "",
      id: `local-${crypto.randomUUID()}`,
      name: "Nuevo flujo",
      status: "draft",
      steps: [createBlankStep(0)],
      trigger_config: {},
      trigger_type: "manual",
      workspace_id: workspaceId ?? "",
    };

    setLocalFlows((current) => [empty, ...current]);
    setSelectedFlowId(empty.id);
    setDraft(empty);
    setSelectedStepId(empty.steps[0]?.id ?? "");
  }

  const counts = draft ? getFlowCounts(runs, draft.id) : null;
  const selectedStepIndex = draft?.steps.findIndex((step) => step.id === selectedStepId) ?? -1;
  const selectedStep =
    selectedStepIndex >= 0 ? draft?.steps[selectedStepIndex] : draft?.steps[0];
  const flowStages = getFlowStages(draft);
  const stagesWithSteps = flowStages.map((stage) => ({
    ...stage,
    steps: draft?.steps.filter((step) => (step.stageKey ?? "inicio") === stage.key) ?? [],
  }));

  function moveSelectedStep(direction: "down" | "up") {
    if (!draft || selectedStepIndex < 0) {
      return;
    }

    const targetIndex = direction === "up" ? selectedStepIndex - 1 : selectedStepIndex + 1;

    if (targetIndex < 0 || targetIndex >= draft.steps.length) {
      return;
    }

    const nextSteps = orderAndLinkPipelineSteps(draft.steps, flowStages);
    const [movedStep] = nextSteps.splice(selectedStepIndex, 1);
    nextSteps.splice(targetIndex, 0, movedStep);
    updateDraft({ steps: orderAndLinkPipelineSteps(nextSteps, flowStages) });
    setSelectedStepId(movedStep.id);
  }

  function addStage() {
    if (!draft) {
      return;
    }

    const existingStages = getFlowStages(draft);
    const nextIndex = existingStages.length + 1;
    const key = `etapa_${nextIndex}_${crypto.randomUUID().slice(0, 5)}`;

    updateDraft({
      trigger_config: {
        ...draft.trigger_config,
        stages: [
          ...existingStages,
          {
            description: "Nueva etapa del flujo.",
            key,
            label: `Etapa ${nextIndex}`,
          },
        ],
      },
    });
  }

  function updateStage(stageKey: string, patch: Partial<FlowStage>) {
    if (!draft) {
      return;
    }

    updateDraft({
      trigger_config: {
        ...draft.trigger_config,
        stages: flowStages.map((stage) =>
          stage.key === stageKey ? { ...stage, ...patch } : stage,
        ),
      },
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[330px_1fr]">
      <aside className="rounded-lg border border-[#d9ded3] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase text-[#647067]">Builder</p>
            <h2 className="text-lg font-semibold">Flujos</h2>
          </div>
          <Workflow className="text-[#35735b]" size={22} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[#e2e6df] p-2">
            <p className="text-lg font-semibold">{draft?.steps.length ?? 0}</p>
            <p className="text-xs text-[#647067]">pasos</p>
          </div>
          <div className="rounded-lg border border-[#e2e6df] p-2">
            <p className="text-lg font-semibold">{activeFlows}</p>
            <p className="text-xs text-[#647067]">activos</p>
          </div>
          <div className="rounded-lg border border-[#e2e6df] p-2">
            <p className="text-lg font-semibold">{runs.length}</p>
            <p className="text-xs text-[#647067]">runs</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {!draft ? (
            <>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white"
                onClick={createEmptyFlow}
                type="button"
              >
                <Plus size={16} />
                Crear flujo
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium disabled:opacity-60"
                disabled={saving === "template"}
                onClick={createTemplate}
                type="button"
              >
                {saving === "template" ? <Loader2 className="animate-spin" size={16} /> : <Bot size={16} />}
                Plantilla LEVY
              </button>
            </>
          ) : (
            <p className="rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3 text-xs text-[#647067]">
              En esta version hay un solo flujo por empresa. La lista de abajo es el recorrido paso a paso.
            </p>
          )}
          {draft ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
              onClick={addStage}
              type="button"
            >
              <Plus size={16} />
              Anadir etapa
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">
          {draft
            ? stagesWithSteps.map((stage, stageIndex) => (
                <div
                  className="rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-2"
                  key={stage.key}
                >
                  <div className="flex items-center justify-between gap-2 px-1 py-1">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#647067]">
                        Etapa {stageIndex + 1}
                      </p>
                      <input
                        className="h-8 w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold outline-none focus:border-[#cbd2c6] focus:bg-white focus:px-2"
                        onChange={(event) =>
                          updateStage(stage.key, { label: event.target.value })
                        }
                        value={stage.label}
                      />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] text-[#4d5a51]">
                      <Check size={12} />
                      {stage.steps.filter((step) => step.requiredForStage !== false).length}
                    </span>
                  </div>
                  <input
                    className="mb-2 h-7 w-full rounded-lg border border-transparent bg-transparent px-1 text-[11px] text-[#7a847c] outline-none focus:border-[#cbd2c6] focus:bg-white"
                    onChange={(event) =>
                      updateStage(stage.key, { description: event.target.value })
                    }
                    value={stage.description}
                  />
                  <div className="grid gap-1.5">
                    {stage.steps.map((step) => {
                      const globalIndex = draft.steps.findIndex((item) => item.id === step.id);
                      return (
              <button
                className={`rounded-lg border bg-white p-3 text-left transition ${
                  selectedStep?.id === step.id
                    ? "border-[#35735b] bg-[#f3f8ed]"
                    : "border-[#e2e6df] hover:bg-[#fafbf8]"
                }`}
                key={step.id}
                onClick={() => setSelectedStepId(step.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                        step.requiredForStage !== false
                          ? "border-[#35735b] bg-[#e7f3ec] text-[#35735b]"
                          : "border-[#cbd2c6] text-[#a0aaa2]"
                      }`}
                      title={
                        step.requiredForStage !== false
                          ? "Checkpoint requerido"
                          : "Paso opcional"
                      }
                    >
                      {step.requiredForStage !== false ? <Check size={13} /> : null}
                    </span>
                    Paso {globalIndex + 1}
                  </p>
                  <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-[11px] text-[#4d5a51]">
                    {flowStepTypes.find((type) => type.value === step.type)?.label ?? step.type}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-[#20231f]">{step.name}</p>
                <p className="mt-1 text-xs text-[#7a847c]">
                  {step.type === "question" || step.type === "options"
                    ? "Espera y guarda una respuesta"
                    : step.type === "wait"
                      ? "Continua al cumplirse el tiempo"
                      : step.type === "message" && step.waitForInbound !== false
                        ? "Continua cuando el cliente escriba"
                        : "Se completa automaticamente"}
                </p>
              </button>
                      );
                    })}
                    {stage.steps.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[#d9ded3] bg-white p-2 text-xs text-[#7a847c]">
                        Sin pasos en esta etapa.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            : null}
          {!draft ? (
            <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              Crea un flujo desde cero o duplica la plantilla LEVY.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="grid gap-4">
        {!draft ? (
          <div className="rounded-lg border border-dashed border-[#d9ded3] bg-white p-6 text-sm text-[#647067]">
            Selecciona o crea un flujo para empezar.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_190px]">
                <label className="grid gap-1.5 text-sm font-medium">
                  Nombre del flujo
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    value={draft.name}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Estado
                  <select
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                    onChange={(event) =>
                      updateDraft({ status: event.target.value as FlowStatus })
                    }
                    value={draft.status}
                  >
                    {statuses.map((statusItem) => (
                      <option key={statusItem.value} value={statusItem.value}>
                        {statusItem.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Trigger
                  <select
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                    onChange={(event) =>
                      updateDraft({
                        trigger_config: {
                          ...draft.trigger_config,
                        },
                        trigger_type: event.target.value as FlowTriggerType,
                      })
                    }
                    value={draft.trigger_type}
                  >
                    {triggers.map((trigger) => (
                      <option key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
                <label className="grid gap-1.5 text-sm font-medium">
                  Descripcion interna
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    placeholder="Ej: onboarding para leads frios"
                    value={draft.description}
                  />
                </label>
                <TriggerConfigEditor flow={draft} onChange={updateDraft} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#647067]">
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef2eb] px-2 py-1">
                  <GitBranch size={13} />
                  Company code: {workspaceCode ?? "sin codigo"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef2eb] px-2 py-1">
                  <MessageSquareText size={13} />
                  WhatsApp por YCloud
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef2eb] px-2 py-1">
                  <UserRound size={13} />
                  GHL: {ghlConfig.location_id ? "conectado" : "sin Location ID"}
                </span>
                {counts ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef2eb] px-2 py-1">
                    <Clock3 size={13} />
                    {counts.active} activos / {counts.transferred} transferidos
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:opacity-60"
                  disabled={saving === "save"}
                  onClick={() => saveFlow()}
                  type="button"
                >
                  {saving === "save" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Guardar
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
                  onClick={() => saveFlow(draft.status === "active" ? "paused" : "active")}
                  type="button"
                >
                  <Check size={16} />
                  {draft.status === "active" ? "Pausar" : "Guardar y activar"}
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
                  onClick={() => {
                    const nextStep = {
                      ...createBlankStep(draft.steps.length),
                      stageKey: selectedStep?.stageKey ?? flowStages[0]?.key ?? "inicio",
                    };
                    updateDraft({
                      steps: orderAndLinkPipelineSteps(
                        [...draft.steps, nextStep],
                        flowStages,
                      ),
                    });
                    setSelectedStepId(nextStep.id);
                  }}
                  type="button"
                >
                  <Plus size={16} />
                  Anadir paso
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
                  disabled={saving === "archive"}
                  onClick={archiveFlow}
                  type="button"
                >
                  {saving === "archive" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Archivar flujo
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {selectedStep && selectedStepIndex >= 0 ? (
                <StepEditor
                  agents={agents.filter((agent) => agent.is_active)}
                  calendars={calendars}
                  canMoveDown={selectedStepIndex < draft.steps.length - 1}
                  canMoveUp={selectedStepIndex > 0}
                  flowStages={flowStages}
                  key={selectedStep.id}
                  onChange={(nextStep) => updateStep(selectedStepIndex, nextStep)}
                  onDelete={() => {
                    const remainingSteps = draft.steps.filter(
                      (_, stepIndex) => stepIndex !== selectedStepIndex,
                    );
                    updateDraft({ steps: remainingSteps });
                    setSelectedStepId(
                      remainingSteps[selectedStepIndex]?.id ??
                        remainingSteps[selectedStepIndex - 1]?.id ??
                        "",
                    );
                  }}
                  onMoveDown={() => moveSelectedStep("down")}
                  onMoveUp={() => moveSelectedStep("up")}
                  step={selectedStep}
                  stepOptions={draft.steps}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-[#d9ded3] bg-white p-6 text-sm text-[#647067]">
                  Este flujo no tiene pasos. Anade el primer paso para empezar.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
              <h3 className="text-sm font-semibold">Preview rapido</h3>
              <div className="mt-3 grid gap-2">
                {draft.steps
                  .filter((step) => step.message)
                  .slice(0, 4)
                  .map((step) => (
                    <div
                      className="rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3 text-sm"
                      key={step.id}
                    >
                      <p className="mb-1 text-xs font-semibold text-[#647067]">{step.name}</p>
                      <p className="whitespace-pre-wrap">{step.message}</p>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {status ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-[#eef2eb] px-3 py-2 text-sm text-[#4d5a51]">
            <Check size={15} />
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
