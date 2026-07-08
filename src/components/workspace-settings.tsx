"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  KeyRound,
  Loader2,
  Plus,
  PlugZap,
  Save,
  UsersRound,
  Wrench,
} from "lucide-react";

import { AgentSettings } from "@/components/agent-settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

type IntegrationItem = {
  config: Json;
  id: string;
  last_error: string | null;
  provider: "ycloud" | "openai" | "gohighlevel";
  secret_ref: string | null;
  status: "pending" | "active" | "error" | "disabled";
  workspace_id: string;
};

type WorkspaceAsset = {
  content: string;
  id: string;
  kind: "business_profile" | "tool" | "template" | "knowledge";
  status: "draft" | "active" | "archived";
  title: string;
  workspace_id: string;
};

type WorkspaceMember = {
  created_at: string;
  id: string;
  role: "owner" | "admin" | "agent" | "viewer";
  user_id: string;
  workspace_id: string;
};

type AgentItem = {
  config: Json;
  id: string;
  is_active: boolean;
  model: string;
  name: string;
  system_prompt: string;
  temperature: number;
  type: string;
  workspace_id: string;
};

type WorkspaceSettingsProps = {
  agents: AgentItem[];
  appUrl: string;
  assets: WorkspaceAsset[];
  initialTab?: TabId;
  integrations: IntegrationItem[];
  members: WorkspaceMember[];
  showNavigation?: boolean;
  workspaceId: string | null;
  workspaceName: string;
};

const tabs = [
  { id: "agents", icon: UsersRound, label: "Agentes" },
  { id: "integrations", icon: PlugZap, label: "Integraciones" },
  { id: "business", icon: BriefcaseBusiness, label: "Negocio" },
  { id: "tools", icon: Wrench, label: "Tools" },
  { id: "templates", icon: ClipboardList, label: "Templates" },
  { id: "knowledge", icon: BookOpenText, label: "Knowledge Base" },
  { id: "team", icon: UsersRound, label: "Equipo" },
  { id: "automations", icon: Check, label: "Automatizaciones" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const hashToTab: Record<string, TabId> = {
  "#workspace-agents": "agents",
  "#workspace-automations": "automations",
  "#workspace-business": "business",
  "#workspace-integrations": "integrations",
  "#workspace-knowledge": "knowledge",
  "#workspace-team": "team",
  "#workspace-templates": "templates",
  "#workspace-tools": "tools",
};

const providers = [
  {
    description: "Datos del numero conectado en YCloud.",
    fields: [
      ["phone_e164", "Numero WhatsApp con pais"],
      ["waba_id", "WABA ID de YCloud"],
      ["phone_id", "Phone ID del numero (opcional)"],
      ["webhook_secret_ref", "Nombre del secret"],
    ],
    label: "YCloud",
    provider: "ycloud",
  },
  {
    description: "API key server-side y modelo base del agente.",
    fields: [
      ["api_key_ref", "API key ref"],
      ["default_model", "Modelo default"],
    ],
    label: "OpenAI",
    provider: "openai",
  },
  {
    description: "CRM para contactos, oportunidades y agenda.",
    fields: [
      ["location_id", "Location ID"],
      ["api_key_ref", "API key ref"],
    ],
    label: "GoHighLevel",
    provider: "gohighlevel",
  },
] as const;

const toolPresets = [
  {
    content:
      "Accion: crea una cita directamente en GoHighLevel. Inputs: nombre, telefono, fecha, hora, calendario y notas. Requiere GHL_API_KEY y Location ID.",
    title: "Agendar en GoHighLevel",
  },
  {
    content:
      "Accion: consulta horarios disponibles en el calendario de GoHighLevel antes de reservar. Inputs: rango de fechas y calendario.",
    title: "Consultar disponibilidad",
  },
  {
    content:
      "Accion: devuelve el link de agenda para que el contacto reserve por su cuenta. Es una tool de lectura.",
    title: "Agendamiento por link",
  },
  {
    content:
      "Accion: herramienta de prueba que devuelve el mensaje recibido. Usala solo para validar flujos internos.",
    title: "Echo",
  },
  {
    content:
      "Accion: llama un webhook HTTPS propio con payload JSON. Usar solo cuando el endpoint y permisos esten claros.",
    title: "Webhook personalizado",
  },
] as const;

function asRecord(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")]),
  );
}

function buildAssetDraft(kind: WorkspaceAsset["kind"], assets: WorkspaceAsset[]) {
  const current = assets.find((asset) => asset.kind === kind);
  return {
    content: current?.content ?? "",
    id: current?.id ?? "",
    status: current?.status ?? "draft",
    title: current?.title ?? "",
  };
}

function stableDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function fieldHelp(provider: string, key: string) {
  if (provider === "ycloud") {
    const helpers: Record<string, { help: string; placeholder: string }> = {
      phone_e164: {
        help: "El numero real conectado en YCloud. Ejemplo: +34600111222.",
        placeholder: "+34600111222",
      },
      waba_id: {
        help: "WhatsApp Business Account ID. Sale en YCloud > WhatsApp Accounts.",
        placeholder: "123456789012345",
      },
      phone_id: {
        help: "Opcional. Si YCloud no lo muestra en esta pantalla, dejalo vacio; el webhook tambien buscara por WABA ID o numero.",
        placeholder: "Opcional: phone_... o el ID tecnico si YCloud lo muestra",
      },
      webhook_secret_ref: {
        help: "Debe coincidir exactamente con YCLOUD_WEBHOOK_SECRET en Vercel. Si no quieres guardar el valor aqui, pegalo manualmente en YCloud.",
        placeholder: "mejora_david_segura_2026",
      },
    };

    return helpers[key];
  }

  if (provider === "gohighlevel" && key === "location_id") {
    return {
      help: "Location ID del subaccount en GoHighLevel.",
      placeholder: "location_id",
    };
  }

  return {
    help: "Referencia interna. El valor real de la API key va en Vercel.",
    placeholder: key,
  };
}

export function WorkspaceSettings({
  agents,
  appUrl,
  assets,
  initialTab = "agents",
  integrations,
  members,
  showNavigation = true,
  workspaceId,
  workspaceName,
}: WorkspaceSettingsProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [localIntegrations, setLocalIntegrations] = useState(integrations);
  const [localAssets, setLocalAssets] = useState(assets);
  const [integrationDrafts, setIntegrationDrafts] = useState(() =>
    Object.fromEntries(
      providers.map((provider) => {
        const current = integrations.find(
          (integration) => integration.provider === provider.provider,
        );
        return [
          provider.provider,
          {
            config: asRecord(current?.config ?? {}),
            status: current?.status ?? "pending",
          },
        ];
      }),
    ) as Record<
      IntegrationItem["provider"],
      { config: Record<string, string>; status: IntegrationItem["status"] }
    >,
  );
  const [assetDrafts, setAssetDrafts] = useState(() => ({
    business_profile: buildAssetDraft("business_profile", assets),
    knowledge: buildAssetDraft("knowledge", assets),
    template: buildAssetDraft("template", assets),
    tool: buildAssetDraft("tool", assets),
  }));
  const [status, setStatus] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const ycloudSecretValue = integrationDrafts.ycloud.config.webhook_secret_ref?.trim();
  const webhookSecretParam = encodeURIComponent(
    ycloudSecretValue || "TU_YCLOUD_WEBHOOK_SECRET",
  );
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/ycloud?secret=${webhookSecretParam}`;
  const assetsByKind = useMemo(
    () =>
      localAssets.reduce<Record<string, WorkspaceAsset[]>>((grouped, asset) => {
        grouped[asset.kind] ??= [];
        grouped[asset.kind].push(asset);
        return grouped;
      }, {}),
    [localAssets],
  );
  const tools = assetsByKind.tool ?? [];
  const knowledgeAssets = assetsByKind.knowledge ?? [];

  useEffect(() => {
    function syncTabFromHash() {
      const nextTab = hashToTab[window.location.hash];

      if (nextTab) {
        setActiveTab(nextTab);
      }
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  async function saveIntegration(provider: IntegrationItem["provider"]) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(provider);
    setStatus("");

    const draft = integrationDrafts[provider];
    const existing = localIntegrations.find(
      (integration) => integration.provider === provider,
    );
    const payload = {
      config: draft.config,
      provider,
      status: draft.status,
      workspace_id: workspaceId,
    };
    const query = existing
      ? supabase
          .from("integrations")
          .update(payload)
          .eq("id", existing.id)
          .select("id, workspace_id, provider, status, config, secret_ref, last_error")
          .single()
      : supabase
          .from("integrations")
          .insert(payload)
          .select("id, workspace_id, provider, status, config, secret_ref, last_error")
          .single();

    const { data, error } = await query;

    if (error) {
      setStatus(error.message);
      setSavingKey("");
      return;
    }

    setLocalIntegrations((current) => {
      const withoutProvider = current.filter(
        (integration) => integration.provider !== provider,
      );
      return [...withoutProvider, data as IntegrationItem];
    });
    setStatus("Integracion guardada.");
    setSavingKey("");
  }

  async function saveAsset(kind: WorkspaceAsset["kind"]) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(kind);
    setStatus("");

    const draft = assetDrafts[kind];
    const existing = localAssets.find((asset) => asset.id === draft.id);
    const payload = {
      content: draft.content,
      kind,
      status: draft.status,
      title: draft.title || workspaceName,
      workspace_id: workspaceId,
    };
    const query = existing
      ? supabase
          .from("workspace_assets")
          .update(payload)
          .eq("id", existing.id)
          .select("id, workspace_id, kind, title, content, status")
          .single()
      : supabase
          .from("workspace_assets")
          .insert(payload)
          .select("id, workspace_id, kind, title, content, status")
          .single();

    const { data, error } = await query;

    if (error) {
      setStatus(
        error.message.includes("workspace_assets")
          ? "Falta correr el SQL de workspace_assets en Supabase."
          : error.message,
      );
      setSavingKey("");
      return;
    }

    setLocalAssets((current) => {
      const withoutAsset = current.filter((asset) => asset.id !== data.id);
      return [...withoutAsset, data as WorkspaceAsset];
    });
    setAssetDrafts((current) => ({
      ...current,
      [kind]: {
        content: data.content,
        id: data.id,
        status: data.status,
        title: data.title,
      },
    }));
    setStatus("Workspace actualizado.");
    setSavingKey("");
  }

  async function createAsset(
    kind: WorkspaceAsset["kind"],
    title: string,
    content: string,
    status: WorkspaceAsset["status"] = "active",
  ) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(`${kind}:${title}`);
    setStatus("");

    const { data, error } = await supabase
      .from("workspace_assets")
      .insert({
        content,
        kind,
        status,
        title,
        workspace_id: workspaceId,
      })
      .select("id, workspace_id, kind, title, content, status")
      .single();

    if (error) {
      setStatus(
        error.message.includes("workspace_assets")
          ? "Falta correr el SQL de workspace_assets en Supabase."
          : error.message,
      );
      setSavingKey("");
      return;
    }

    setLocalAssets((current) => [data as WorkspaceAsset, ...current]);
    setStatus("Recurso agregado.");
    setSavingKey("");
  }

  function assetList(kind: WorkspaceAsset["kind"], empty: string) {
    const currentAssets = assetsByKind[kind] ?? [];

    return (
      <div className="grid gap-2">
        {currentAssets.map((asset) => (
          <div
            className="flex items-start justify-between gap-3 rounded-lg border border-[#e2e6df] p-3 text-sm"
            key={asset.id}
          >
            <div className="min-w-0">
              <p className="font-semibold">{asset.title}</p>
              <p className="mt-1 line-clamp-2 text-[#647067]">{asset.content}</p>
            </div>
            <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
              {asset.status}
            </span>
          </div>
        ))}
        {currentAssets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
            {empty}
          </p>
        ) : null}
      </div>
    );
  }

  function assetEditor({
    helper,
    kind,
    placeholder,
    title,
  }: {
    helper: string;
    kind: WorkspaceAsset["kind"];
    placeholder: string;
    title: string;
  }) {
    const draft = assetDrafts[kind];

    return (
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-[#647067]">{helper}</p>
        </div>
        <input
          className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
          onChange={(event) =>
            setAssetDrafts((current) => ({
              ...current,
              [kind]: { ...current[kind], title: event.target.value },
            }))
          }
          placeholder="Titulo"
          value={draft.title}
        />
        <textarea
          className="min-h-32 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
          onChange={(event) =>
            setAssetDrafts((current) => ({
              ...current,
              [kind]: { ...current[kind], content: event.target.value },
            }))
          }
          placeholder={placeholder}
          value={draft.content}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
            onChange={(event) =>
              setAssetDrafts((current) => ({
                ...current,
                [kind]: {
                  ...current[kind],
                  status: event.target.value as WorkspaceAsset["status"],
                },
              }))
            }
            value={draft.status}
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
            disabled={savingKey === kind}
            onClick={() => saveAsset(kind)}
            type="button"
          >
            {savingKey === kind ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-[#d9ded3] bg-white">
      {showNavigation ? (
      <div className="border-b border-[#e2e6df] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold">Workspace</h2>
            <p className="text-sm text-[#647067]">
              Integraciones, contexto del negocio y recursos del agente.
            </p>
          </div>
          <span className="rounded-lg bg-[#eef2eb] px-2.5 py-1 text-xs font-semibold text-[#4d5a51]">
            {workspaceName}
          </span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-[#10231c] text-white"
                  : "bg-[#eef2eb] text-[#4d5a51]"
              }`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                window.history.replaceState(null, "", `#workspace-${tab.id}`);
              }}
              type="button"
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      <div className="p-4">
        {activeTab === "agents" ? (
          <AgentSettings
            agents={agents}
            knowledgeAssets={knowledgeAssets}
            tools={tools}
            workspaceId={workspaceId}
          />
        ) : null}

        {activeTab === "integrations" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {providers.map((provider) => {
              const draft = integrationDrafts[provider.provider];
              const connected = localIntegrations.find(
                (integration) => integration.provider === provider.provider,
              );

              return (
                <div
                  className="grid content-start gap-3 rounded-lg border border-[#e2e6df] p-3"
                  key={provider.provider}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{provider.label}</h3>
                      <p className="mt-1 text-sm text-[#647067]">
                        {provider.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-1 text-xs ${
                        connected?.status === "active"
                          ? "bg-[#e7f6ce] text-[#31521d]"
                          : "bg-[#eef2eb] text-[#4d5a51]"
                      }`}
                    >
                      {connected?.status ?? "pending"}
                    </span>
                  </div>
                  {provider.provider === "ycloud" ? (
                    <div className="rounded-lg border border-dashed border-[#cbd2c6] bg-[#fafbf8] p-2 text-xs text-[#4d5a51]">
                      <p className="font-semibold">Webhook URL para pegar en YCloud</p>
                      <p className="mt-1 break-all">{webhookUrl}</p>
                      <p className="mt-2">
                        {ycloudSecretValue
                          ? "Esta URL usa el valor escrito en Nombre del secret. Ese valor debe ser igual al YCLOUD_WEBHOOK_SECRET de Vercel."
                          : "Reemplaza TU_YCLOUD_WEBHOOK_SECRET por el mismo valor que guardaste en Vercel."}
                      </p>
                    </div>
                  ) : null}
                  {provider.fields.map(([key, label]) => {
                    const helper = fieldHelp(provider.provider, key);

                    return (
                      <label className="grid gap-1.5 text-sm font-medium" key={key}>
                        {label}
                        <input
                          className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                          onChange={(event) =>
                            setIntegrationDrafts((current) => ({
                              ...current,
                              [provider.provider]: {
                                ...current[provider.provider],
                                config: {
                                  ...current[provider.provider].config,
                                  [key]: event.target.value,
                                },
                              },
                            }))
                          }
                          placeholder={helper.placeholder}
                          type={key.includes("key") ? "password" : "text"}
                          value={draft.config[key] ?? ""}
                        />
                        <span className="text-xs font-normal text-[#647067]">
                          {helper.help}
                        </span>
                      </label>
                    );
                  })}
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                      onChange={(event) =>
                        setIntegrationDrafts((current) => ({
                          ...current,
                          [provider.provider]: {
                            ...current[provider.provider],
                            status: event.target.value as IntegrationItem["status"],
                          },
                        }))
                      }
                      value={draft.status}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="active">Activa</option>
                      <option value="error">Error</option>
                      <option value="disabled">Desactivada</option>
                    </select>
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                      disabled={savingKey === provider.provider}
                      onClick={() => saveIntegration(provider.provider)}
                      type="button"
                    >
                      {savingKey === provider.provider ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <KeyRound size={16} />
                      )}
                      Guardar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {activeTab === "business"
          ? assetEditor({
              helper: "Contexto estable que el agente usa para responder como el negocio.",
              kind: "business_profile",
              placeholder:
                "Servicios, horarios, ubicacion, politicas, tono de marca, precios base...",
              title: "Info del negocio",
            })
          : null}

        {activeTab === "tools" ? (
          <div className="grid gap-5">
            <div>
              <h3 className="text-sm font-semibold">Catalogo de Tools</h3>
              <p className="mt-1 text-sm text-[#647067]">
                Crea capacidades reutilizables y luego asignalas a cada agente.
              </p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {toolPresets.map((tool) => (
                <div
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#e2e6df] p-3"
                  key={tool.title}
                >
                  <div>
                    <p className="text-sm font-semibold">{tool.title}</p>
                    <p className="mt-1 text-sm text-[#647067]">{tool.content}</p>
                  </div>
                  <button
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                    disabled={savingKey === `tool:${tool.title}`}
                    onClick={() => createAsset("tool", tool.title, tool.content)}
                    type="button"
                  >
                    {savingKey === `tool:${tool.title}` ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <Plus size={15} />
                    )}
                    Agregar
                  </button>
                </div>
              ))}
            </div>
            {assetEditor({
              helper: "Crea una tool personalizada si necesitas un flujo que no esta en el catalogo.",
              kind: "tool",
              placeholder:
                "Tool: agendar_cita\nCuando usarla: si el contacto pide fecha/hora\nInputs: nombre, telefono, fecha...",
              title: "Tool personalizada",
            })}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Tools disponibles</h3>
              {assetList("tool", "Todavia no hay tools creadas.")}
            </div>
          </div>
        ) : null}

        {activeTab === "templates" ? (
          <div className="grid gap-5">
            {assetEditor({
              helper: "Borradores de plantillas para aprobacion en Meta/YCloud.",
              kind: "template",
              placeholder:
                "Nombre: recordatorio_cita\nCategoria: utility\nTexto: Hola {{1}}, te recordamos tu cita...",
              title: "Nueva plantilla WhatsApp",
            })}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Mis plantillas</h3>
              {assetList("template", "Sin plantillas. Crea una nueva o sincroniza desde YCloud.")}
            </div>
          </div>
        ) : null}

        {activeTab === "knowledge" ? (
          <div className="grid gap-5">
            {assetEditor({
              helper: "FAQ, objeciones, politicas, precios y respuestas aprobadas para asignar a agentes.",
              kind: "knowledge",
              placeholder:
                "Pregunta: cuanto cuesta?\nRespuesta: depende del plan...\n\nPregunta: donde estan ubicados?",
              title: "Agregar documento",
            })}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Documentos</h3>
              {assetList("knowledge", "No hay documentos en la base de conocimiento.")}
            </div>
          </div>
        ) : null}

        {activeTab === "team" ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Equipo del workspace</h3>
                <p className="mt-1 text-sm text-[#647067]">
                  Miembros actuales y roles visibles por RLS.
                </p>
              </div>
              <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                {members.length} miembros
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {members.map((member) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6df] p-3 text-sm"
                  key={member.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.user_id}</p>
                    <p className="mt-1 text-xs text-[#647067]">
                      Alta {stableDate(member.created_at)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#e7f6ce] px-2 py-1 text-xs text-[#31521d]">
                    {member.role}
                  </span>
                </div>
              ))}
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                  Aun no hay miembros visibles en este workspace.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === "automations" ? (
          <div className="rounded-lg border border-[#e2e6df] p-4">
            <h3 className="text-sm font-semibold">Automatizaciones</h3>
            <p className="mt-1 text-sm text-[#647067]">
              Aqui vamos a conectar reglas como buffer IA, entrega de mensajes,
              recordatorios y sincronizacion con GHL. Por ahora quedan listas las
              bases para configurar agentes, tools y conocimiento.
            </p>
          </div>
        ) : null}

        {status ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#eef2eb] px-3 py-2 text-sm text-[#4d5a51]">
            <Check size={15} />
            {status}
          </p>
        ) : null}

        {activeTab !== "integrations" && assetsByKind[activeTab]?.length ? null : null}
      </div>
    </section>
  );
}
