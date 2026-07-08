"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  UsersRound,
  Wrench,
} from "lucide-react";

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

type WorkspaceSettingsProps = {
  appUrl: string;
  assets: WorkspaceAsset[];
  integrations: IntegrationItem[];
  members: WorkspaceMember[];
  workspaceId: string | null;
  workspaceName: string;
};

const tabs = [
  { id: "integrations", icon: PlugZap, label: "Integraciones" },
  { id: "business", icon: BriefcaseBusiness, label: "Negocio" },
  { id: "tools", icon: Wrench, label: "Tools" },
  { id: "templates", icon: ClipboardList, label: "Plantillas" },
  { id: "knowledge", icon: BookOpenText, label: "Base" },
  { id: "team", icon: UsersRound, label: "Equipo" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const providers = [
  {
    description: "WhatsApp oficial, Phone ID, WABA ID y webhook.",
    fields: [
      ["phone_e164", "Numero WhatsApp"],
      ["waba_id", "WABA ID"],
      ["phone_id", "Phone ID"],
      ["webhook_secret_ref", "Webhook secret ref"],
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

export function WorkspaceSettings({
  appUrl,
  assets,
  integrations,
  members,
  workspaceId,
  workspaceName,
}: WorkspaceSettingsProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>("integrations");
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

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/ycloud`;
  const assetsByKind = useMemo(
    () =>
      localAssets.reduce<Record<string, WorkspaceAsset[]>>((grouped, asset) => {
        grouped[asset.kind] ??= [];
        grouped[asset.kind].push(asset);
        return grouped;
      }, {}),
    [localAssets],
  );

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
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
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
                      <p className="font-semibold">Webhook URL</p>
                      <p className="mt-1 break-all">{webhookUrl}</p>
                    </div>
                  ) : null}
                  {provider.fields.map(([key, label]) => (
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
                        type={key.includes("key") || key.includes("secret") ? "password" : "text"}
                        value={draft.config[key] ?? ""}
                      />
                    </label>
                  ))}
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

        {activeTab === "tools"
          ? assetEditor({
              helper: "Define herramientas disponibles: agendar, consultar CRM, crear lead, escalar a humano.",
              kind: "tool",
              placeholder:
                "Tool: agendar_cita\nCuando usarla: si el contacto pide fecha/hora\nInputs: nombre, telefono, fecha...",
              title: "Tools del agente",
            })
          : null}

        {activeTab === "templates"
          ? assetEditor({
              helper: "Borradores de plantillas para aprobacion en Meta.",
              kind: "template",
              placeholder:
                "Nombre: recordatorio_cita\nCategoria: utility\nTexto: Hola {{1}}, te recordamos tu cita...",
              title: "Plantillas WhatsApp",
            })
          : null}

        {activeTab === "knowledge"
          ? assetEditor({
              helper: "FAQ, objeciones, datos del producto y respuestas aprobadas.",
              kind: "knowledge",
              placeholder:
                "Pregunta: cuanto cuesta?\nRespuesta: depende del plan...\n\nPregunta: donde estan ubicados?",
              title: "Base de conocimiento",
            })
          : null}

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
                      Alta {new Date(member.created_at).toLocaleDateString("es-CO")}
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
