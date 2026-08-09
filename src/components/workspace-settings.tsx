"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  CircleX,
  ClipboardList,
  KeyRound,
  Loader2,
  Plus,
  PlugZap,
  Pencil,
  Save,
  Trash2,
  UsersRound,
  Wrench,
} from "lucide-react";

import { AgentSettings } from "@/components/agent-settings";
import {
  buildCalendarToolMetadata,
  isCalendarTool,
  parseCalendarTools,
} from "@/lib/calendar-tools";
import {
  buildBusinessProfileContent,
  businessProfileFields,
  getBusinessProfileMetadata,
  normalizeVariableKey,
} from "@/lib/business-profile";
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

type IntegrationTestResult = {
  error?: string;
  message?: string;
  ok: boolean;
  steps?: Array<{
    detail?: string;
    key: string;
    label: string;
    status: "failed" | "passed";
  }>;
};

type WorkspaceAsset = {
  content: string;
  id: string;
  kind: "business_profile" | "tool" | "template" | "knowledge";
  metadata: Json;
  status: "draft" | "active" | "archived";
  title: string;
  workspace_id: string;
};

type WorkspaceMember = {
  created_at: string;
  display_email?: string;
  display_name?: string;
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
  activeRole?: WorkspaceMember["role"] | "sin acceso";
  agents: AgentItem[];
  appUrl: string;
  assets: WorkspaceAsset[];
  initialTab?: TabId;
  integrations: IntegrationItem[];
  members: WorkspaceMember[];
  showNavigation?: boolean;
  workspaceCode?: string | null;
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
      ["api_key", "YCloud API key"],
      ["phone_e164", "Numero WhatsApp con pais"],
      ["waba_id", "WABA ID de YCloud"],
      ["phone_id", "Phone ID del numero (opcional)"],
      ["webhook_secret", "Secreto webhook"],
    ],
    label: "YCloud",
    provider: "ycloud",
  },
  {
    description: "API key server-side y modelo base del agente.",
    fields: [
      ["api_key", "OpenAI API key"],
      ["default_model", "Modelo default"],
    ],
    label: "OpenAI",
    provider: "openai",
  },
  {
    description: "Conecta tu CRM para que los contactos de WhatsApp entren solos.",
    fields: [
      ["location_id", "Location ID"],
      ["api_key", "GoHighLevel API key"],
    ],
    label: "GoHighLevel",
    provider: "gohighlevel",
  },
] as const;

const toolPresets = [
  {
    content:
      "Accion: crea una cita directamente en GoHighLevel. Inputs: nombre, telefono, fecha, hora, calendario y notas. Requiere GoHighLevel conectado en esta empresa.",
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

/** Kinds con un solo registro por workspace: el editor abre sobre el existente. */
const singletonAssetKinds = new Set<WorkspaceAsset["kind"]>(["business_profile"]);

function buildAssetDraft(kind: WorkspaceAsset["kind"], assets: WorkspaceAsset[]) {
  // Los kinds de coleccion arrancan en blanco. Si se precargaran con el primer
  // documento, editarlo y guardar creaba un duplicado en vez de actualizarlo.
  const current = singletonAssetKinds.has(kind)
    ? assets.find((asset) => asset.kind === kind)
    : undefined;

  return {
    content: current?.content ?? "",
    id: current?.id ?? "",
    metadata: current?.metadata ?? {},
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

/**
 * Zonas horarias IANA reales del navegador. La zona del negocio decide a que
 * hora se agenda, asi que no puede ser texto libre: "Colombia" o "GMT-5" no son
 * zonas validas y se descartarian en silencio al consultar el calendario.
 */
function getTimeZoneOptions() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

const statusLabels: Record<IntegrationItem["status"], string> = {
  active: "Conectado",
  disabled: "Desactivado",
  error: "Con error",
  pending: "Sin conectar",
};

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
      webhook_secret: {
        help: "Se usara solo para generar y validar la URL del webhook de esta empresa.",
        placeholder: "Dejalo vacio para generar uno automaticamente",
      },
      api_key: {
        help: "Se cifra en el backend y se usa solo para enviar mensajes de este numero.",
        placeholder: "YCloud API key",
      },
    };

    return helpers[key];
  }

  if (provider === "gohighlevel" && key === "location_id") {
    return {
      help: "En GoHighLevel: Settings > Business Profile. Es el ID de la subcuenta de tu negocio.",
      placeholder: "location_id",
    };
  }

  if (provider === "gohighlevel" && key === "api_key") {
    return {
      // Debe ser Private Integration Token (API v2). La "API Key" de Settings >
      // API Keys es la v1, descontinuada, y no sirve para calendarios ni citas.
      help: "En GoHighLevel: Settings > Private Integrations > Create new Integration. NO uses la API Key vieja. Habilita View/Edit Contacts, View Calendars, View/Edit Calendar Events y View Locations.",
      placeholder: "Private Integration Token",
    };
  }

  if (provider === "openai" && key === "api_key") {
    return {
      help: "Se cifra en el backend y se usa solo para los agentes de esta empresa.",
      placeholder: "sk-...",
    };
  }

  return {
    help: "Dato de configuracion de esta integracion.",
    placeholder: key,
  };
}

export function WorkspaceSettings({
  activeRole = "viewer",
  agents,
  appUrl,
  assets,
  initialTab = "agents",
  integrations,
  members,
  showNavigation = true,
  workspaceCode,
  workspaceId,
  workspaceName,
}: WorkspaceSettingsProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [localIntegrations, setLocalIntegrations] = useState(integrations);
  const [localMembers, setLocalMembers] = useState(members);
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
  const [memberEmail, setMemberEmail] = useState("");
  const [memberResetPassword, setMemberResetPassword] = useState(false);
  const [memberRole, setMemberRole] = useState<WorkspaceMember["role"]>("agent");
  const [memberTemporaryPassword, setMemberTemporaryPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [integrationTestResults, setIntegrationTestResults] = useState<
    Partial<Record<IntegrationItem["provider"], IntegrationTestResult>>
  >({});
  const canChangeMemberRoles = activeRole === "owner";

  const ycloudSecretValue = integrationDrafts.ycloud.config.webhook_secret?.trim();
  const webhookSecretParam = encodeURIComponent(
    ycloudSecretValue || "SECRETO_WEBHOOK_EMPRESA",
  );
  const webhookUrl = workspaceId
    ? `${appUrl}/api/webhooks/ycloud/${workspaceCode ?? workspaceId}/${webhookSecretParam}`
    : "";
  // El secreto de GHL viaja en la cabecera Authorization, no en la URL, y solo
  // esta disponible en claro justo despues de generarlo.
  const ghlWebhookUrl = `${appUrl}/api/webhooks/ghl/send-message`;
  const ghlSecretValue = integrationDrafts.gohighlevel.config.ghl_webhook_secret?.trim();
  const ghlSecretMask = asRecord(
    localIntegrations.find((integration) => integration.provider === "gohighlevel")
      ?.config ?? {},
  ).ghl_webhook_secret_mask;
  const [ghlCalendars, setGhlCalendars] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [ghlCalendarsError, setGhlCalendarsError] = useState("");
  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), []);
  const assetsByKind = useMemo(
    () =>
      localAssets.reduce<Record<string, WorkspaceAsset[]>>((grouped, asset) => {
        grouped[asset.kind] ??= [];
        grouped[asset.kind].push(asset);
        return grouped;
      }, {}),
    [localAssets],
  );
  const tools = useMemo(() => assetsByKind.tool ?? [], [assetsByKind]);
  const calendarTools = useMemo(() => parseCalendarTools(tools), [tools]);
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

  useEffect(() => {
    const hasYCloud = localIntegrations.some(
      (integration) =>
        integration.provider === "ycloud" && integration.status === "active",
    );

    if (!workspaceId || !hasYCloud || ycloudSecretValue) {
      return;
    }

    let cancelled = false;

    async function loadYCloudWebhookUrl() {
      const response = await fetch(
        `/api/integrations/ycloud?workspaceId=${encodeURIComponent(workspaceId!)}`,
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        webhookSecret?: string;
      };

      if (cancelled || !payload.webhookSecret) {
        return;
      }

      setIntegrationDrafts((current) => ({
        ...current,
        ycloud: {
          ...current.ycloud,
          config: {
            ...current.ycloud.config,
            webhook_secret: payload.webhookSecret ?? "",
          },
        },
      }));
    }

    void loadYCloudWebhookUrl();

    return () => {
      cancelled = true;
    };
  }, [localIntegrations, workspaceId, ycloudSecretValue]);

  useEffect(() => {
    const ghlActive = localIntegrations.some(
      (integration) =>
        integration.provider === "gohighlevel" && integration.status === "active",
    );

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
      const payload = (await response.json()) as {
        calendars?: Array<{ id: string; name: string }>;
        error?: string;
      };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setGhlCalendarsError(payload.error ?? "No se pudieron cargar los calendarios.");
        return;
      }

      setGhlCalendarsError("");
      setGhlCalendars(payload.calendars ?? []);
    }

    void loadCalendars();

    return () => {
      cancelled = true;
    };
  }, [localIntegrations, workspaceId]);

  async function saveIntegration(
    provider: IntegrationItem["provider"],
    { regenerateWebhookSecret = false } = {},
  ) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(regenerateWebhookSecret ? `${provider}:secret` : provider);
    setStatus("");

    const draft = integrationDrafts[provider];

    if (provider === "openai" || provider === "ycloud" || provider === "gohighlevel") {
      const endpoint =
        provider === "openai"
          ? "/api/integrations/openai"
          : provider === "ycloud"
            ? "/api/integrations/ycloud"
            : "/api/integrations/gohighlevel";
      const requestBody =
        provider === "openai"
          ? {
              apiKey: draft.config.api_key,
              defaultModel: draft.config.default_model,
              workspaceId,
            }
          : provider === "ycloud"
            ? {
                apiKey: draft.config.api_key,
                phoneE164: draft.config.phone_e164,
                phoneId: draft.config.phone_id,
                wabaId: draft.config.waba_id,
                webhookSecret: draft.config.webhook_secret,
                workspaceId,
              }
            : {
                apiKey: draft.config.api_key,
                calendarId: draft.config.calendar_id,
                locationId: draft.config.location_id,
                regenerateWebhookSecret,
                workspaceId,
              };
      const response = await fetch(endpoint, {
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        integration?: IntegrationItem;
        webhookSecret?: string;
        webhookUrl?: string;
      };

      if (!response.ok || !payload.integration) {
        setStatus(payload.error ?? "No se pudo guardar la integracion.");
        setSavingKey("");
        return;
      }

      if (payload.webhookSecret && provider === "ycloud") {
        setIntegrationDrafts((current) => ({
          ...current,
          ycloud: {
            ...current.ycloud,
            config: {
              ...current.ycloud.config,
              webhook_secret: payload.webhookSecret ?? "",
            },
          },
        }));
      }

      if (payload.webhookSecret && provider === "gohighlevel") {
        setIntegrationDrafts((current) => ({
          ...current,
          gohighlevel: {
            ...current.gohighlevel,
            config: {
              ...current.gohighlevel.config,
              ghl_webhook_secret: payload.webhookSecret ?? "",
            },
          },
        }));
      }

      setLocalIntegrations((current) => {
        const withoutProvider = current.filter(
          (integration) => integration.provider !== provider,
        );
        return [...withoutProvider, payload.integration!];
      });
      setStatus(
        regenerateWebhookSecret
          ? "Secreto nuevo generado. Copialo ahora: no se vuelve a mostrar."
          : "Integracion conectada.",
      );
      setSavingKey("");
      return;
    }

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

  async function testIntegration(provider: IntegrationItem["provider"]) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(`${provider}:test`);
    setStatus("");
    setIntegrationTestResults((current) => ({
      ...current,
      [provider]: undefined,
    }));

    const response = await fetch(`/api/integrations/${provider}/test`, {
      body: JSON.stringify({ workspaceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as IntegrationTestResult;
    setIntegrationTestResults((current) => ({ ...current, [provider]: payload }));

    if (!response.ok || !payload.ok) {
      setStatus(payload.error ?? `No se pudo probar ${provider}.`);
      setSavingKey("");
      return;
    }

    const successMessages: Record<IntegrationItem["provider"], string> = {
      gohighlevel: "GoHighLevel respondio correctamente. La conexion esta lista.",
      openai: "OpenAI respondio correctamente.",
      ycloud: "YCloud respondio correctamente.",
    };

    setStatus(payload.message ?? successMessages[provider]);
    setSavingKey("");
  }

  async function saveAsset(kind: WorkspaceAsset["kind"], options?: { forceCreate?: boolean }) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    setSavingKey(kind);
    setStatus("");

    const draft = assetDrafts[kind];
    if (kind === "knowledge" && (!draft.title.trim() || !draft.content.trim())) {
      setStatus("Escribe titulo y contenido para agregar el documento.");
      setSavingKey("");
      return;
    }
    const existing = options?.forceCreate
      ? null
      : localAssets.find((asset) => asset.id === draft.id);
    const payload = {
      content: draft.content,
      kind,
      metadata: draft.metadata,
      status: draft.status,
      title: draft.title || workspaceName,
      workspace_id: workspaceId,
    };
    const query = existing
      ? supabase
          .from("workspace_assets")
          .update(payload)
          .eq("id", existing.id)
          .select("id, workspace_id, kind, title, content, status, metadata")
          .single()
      : supabase
          .from("workspace_assets")
          .insert(payload)
          .select("id, workspace_id, kind, title, content, status, metadata")
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
        content: options?.forceCreate ? "" : data.content,
        id: options?.forceCreate ? "" : data.id,
        metadata: options?.forceCreate ? {} : data.metadata,
        status: options?.forceCreate ? "draft" : data.status,
        title: options?.forceCreate ? "" : data.title,
      },
    }));
    setStatus(
      options?.forceCreate
        ? "Documento agregado."
        : singletonAssetKinds.has(kind)
          ? "Workspace actualizado."
          : "Cambios guardados.",
    );
    setSavingKey("");
  }

  async function deleteAsset(asset: WorkspaceAsset) {
    const label = asset.title || "este recurso";
    const confirmed = window.confirm(`Eliminar ${label}? Esta accion no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    setSavingKey(`asset:delete:${asset.id}`);
    setStatus("");

    const { error } = await supabase
      .from("workspace_assets")
      .delete()
      .eq("id", asset.id)
      .eq("workspace_id", asset.workspace_id);

    if (error) {
      setStatus(error.message);
      setSavingKey("");
      return;
    }

    setLocalAssets((current) => current.filter((item) => item.id !== asset.id));
    setAssetDrafts((current) => {
      const draft = current[asset.kind];

      if (draft.id !== asset.id) {
        return current;
      }

      return {
        ...current,
        [asset.kind]: {
          content: "",
          id: "",
          metadata: {},
          status: "draft",
          title: "",
        },
      };
    });
    setStatus("Documento eliminado.");
    setSavingKey("");
  }

  /**
   * Crea o actualiza una tool de calendario. Solo una puede ser la de por
   * defecto, asi que al marcar una se desmarcan las demas: el agente de citas
   * usa exactamente un calendario y no debe haber ambiguedad.
   */
  async function saveCalendarTool({
    assetId,
    calendarId,
    description,
    makeDefault,
  }: {
    assetId?: string;
    calendarId: string;
    description?: string;
    makeDefault: boolean;
  }) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    const calendar = ghlCalendars.find((item) => item.id === calendarId);

    if (!calendar) {
      setStatus("Elige un calendario de la lista.");
      return;
    }

    setSavingKey(`calendar:${calendarId}`);
    setStatus("");

    const metadata = buildCalendarToolMetadata({
      calendarId: calendar.id,
      calendarName: calendar.name,
      isDefault: makeDefault,
    });
    const payload = {
      content:
        description ??
        `Citas de ${calendar.name}. Describe aqui cuando usar esta agenda.`,
      kind: "tool" as const,
      metadata,
      status: "active" as const,
      title: calendar.name,
      workspace_id: workspaceId,
    };
    const { data, error } = assetId
      ? await supabase
          .from("workspace_assets")
          .update(payload)
          .eq("id", assetId)
          .select("id, workspace_id, kind, title, content, status, metadata")
          .single()
      : await supabase
          .from("workspace_assets")
          .insert(payload)
          .select("id, workspace_id, kind, title, content, status, metadata")
          .single();

    if (error) {
      setStatus(error.message);
      setSavingKey("");
      return;
    }

    const saved = data as WorkspaceAsset;

    if (makeDefault) {
      const toUnset = calendarTools.filter(
        (tool) => tool.isDefault && tool.id !== saved.id,
      );

      for (const tool of toUnset) {
        const asset = localAssets.find((item) => item.id === tool.id);
        await supabase
          .from("workspace_assets")
          .update({
            metadata: { ...asRecord(asset?.metadata ?? {}), is_default: false },
          })
          .eq("id", tool.id);
      }
    }

    setLocalAssets((current) => {
      const withoutSaved = current.filter((asset) => asset.id !== saved.id);
      const reset = makeDefault
        ? withoutSaved.map((asset) =>
            isCalendarTool(asset.metadata)
              ? {
                  ...asset,
                  metadata: { ...asRecord(asset.metadata), is_default: false },
                }
              : asset,
          )
        : withoutSaved;
      return [saved, ...reset];
    });
    setStatus(
      makeDefault
        ? `"${calendar.name}" es ahora el calendario del agente de citas.`
        : "Calendario guardado.",
    );
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
        metadata: {},
        status,
        title,
        workspace_id: workspaceId,
      })
      .select("id, workspace_id, kind, title, content, status, metadata")
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

  async function addMember() {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    const email = memberEmail.trim();

    if (!email) {
      setStatus("Escribe el email de la persona.");
      return;
    }

    setSavingKey("team:add");
    setStatus("");

    const response = await fetch("/api/team/members", {
      body: JSON.stringify({
        email,
        resetPassword: memberResetPassword,
        role: memberRole,
        temporaryPassword: memberTemporaryPassword,
        workspaceId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      member?: WorkspaceMember;
    };

    if (!response.ok || !payload.member) {
      setStatus(payload.error ?? "No se pudo agregar el miembro.");
      setSavingKey("");
      return;
    }

    setLocalMembers((current) => {
      const withoutMember = current.filter((member) => member.id !== payload.member!.id);
      return [payload.member!, ...withoutMember];
    });
    setMemberEmail("");
    setMemberResetPassword(false);
    setMemberTemporaryPassword("");
    setStatus(
      "Miembro agregado. Si creaste o reseteaste la contrasena, ya puede iniciar sesion y cambiar de empresa desde el selector.",
    );
    setSavingKey("");
  }

  async function changeOwnPassword() {
    const current = currentPassword.trim();
    const next = newPassword.trim();

    if (!current) {
      setStatus("Escribe tu contrasena actual.");
      return;
    }

    if (next.length < 8) {
      setStatus("La nueva contrasena debe tener minimo 8 caracteres.");
      return;
    }

    if (next !== newPasswordConfirmation.trim()) {
      setStatus("La confirmacion no coincide con la nueva contrasena.");
      return;
    }

    if (current === next) {
      setStatus("La nueva contrasena debe ser diferente a la actual.");
      return;
    }

    setSavingKey("team:password");
    setStatus("");

    const response = await fetch("/api/account/password", {
      body: JSON.stringify({
        currentPassword: current,
        newPassword: next,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo cambiar la contrasena.");
      setSavingKey("");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setStatus("Contrasena actualizada.");
    setSavingKey("");
  }

  async function removeMember(member: WorkspaceMember) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    const label = member.display_email || member.display_name || member.user_id;
    const confirmed = window.confirm(
      `Eliminar a ${label} de este workspace? Podra volver a entrar solo si lo agregas de nuevo.`,
    );

    if (!confirmed) {
      return;
    }

    setSavingKey(`team:remove:${member.id}`);
    setStatus("");

    const response = await fetch("/api/team/members", {
      body: JSON.stringify({
        memberId: member.id,
        workspaceId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo eliminar el miembro.");
      setSavingKey("");
      return;
    }

    setLocalMembers((current) =>
      current.filter((currentMember) => currentMember.id !== member.id),
    );
    setStatus("Miembro eliminado del workspace.");
    setSavingKey("");
  }

  async function updateMemberRole(member: WorkspaceMember, role: WorkspaceMember["role"]) {
    if (!workspaceId) {
      setStatus("Primero necesitas un workspace activo.");
      return;
    }

    if (member.role === role) {
      return;
    }

    setSavingKey(`team:role:${member.id}`);
    setStatus("");

    const response = await fetch("/api/team/members", {
      body: JSON.stringify({
        memberId: member.id,
        role,
        workspaceId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const payload = (await response.json()) as {
      error?: string;
      member?: WorkspaceMember;
    };

    if (!response.ok || !payload.member) {
      setStatus(payload.error ?? "No se pudo cambiar el permiso.");
      setSavingKey("");
      return;
    }

    const updatedMember = payload.member;
    setLocalMembers((current) =>
      current.map((currentMember) =>
        currentMember.id === updatedMember.id
          ? {
              ...currentMember,
              ...updatedMember,
              display_email: updatedMember.display_email || currentMember.display_email,
              display_name: updatedMember.display_name || currentMember.display_name,
            }
          : currentMember,
      ),
    );
    setStatus("Permiso actualizado.");
    setSavingKey("");
  }

  function updateBusinessField(key: string, value: string) {
    setAssetDrafts((current) => {
      const draft = current.business_profile;
      const metadata = getBusinessProfileMetadata(draft.metadata);
      const nextMetadata = {
        ...metadata,
        fields: {
          ...(metadata.fields ?? {}),
          [key]: value,
        },
      };

      return {
        ...current,
        business_profile: {
          ...draft,
          content: buildBusinessProfileContent(nextMetadata),
          metadata: nextMetadata,
          title:
            key === "company_name" && value.trim()
              ? value.trim()
              : draft.title || workspaceName,
        },
      };
    });
  }

  function updateBusinessCustomField(
    index: number,
    patch: Partial<{ key: string; label: string; value: string }>,
  ) {
    setAssetDrafts((current) => {
      const draft = current.business_profile;
      const metadata = getBusinessProfileMetadata(draft.metadata);
      const customFields = [...(metadata.custom_fields ?? [])];
      const currentField = customFields[index] ?? { key: "", label: "", value: "" };
      const nextField = { ...currentField, ...patch };

      if (patch.label !== undefined && patch.key === undefined && !currentField.key) {
        nextField.key = normalizeVariableKey(patch.label);
      }

      customFields[index] = nextField;

      const nextMetadata = {
        ...metadata,
        custom_fields: customFields,
      };

      return {
        ...current,
        business_profile: {
          ...draft,
          content: buildBusinessProfileContent(nextMetadata),
          metadata: nextMetadata,
        },
      };
    });
  }

  function addBusinessCustomField() {
    setAssetDrafts((current) => {
      const draft = current.business_profile;
      const metadata = getBusinessProfileMetadata(draft.metadata);
      const nextMetadata = {
        ...metadata,
        custom_fields: [
          ...(metadata.custom_fields ?? []),
          { key: "", label: "", value: "" },
        ],
      };

      return {
        ...current,
        business_profile: {
          ...draft,
          metadata: nextMetadata,
        },
      };
    });
  }

  function removeBusinessCustomField(index: number) {
    setAssetDrafts((current) => {
      const draft = current.business_profile;
      const metadata = getBusinessProfileMetadata(draft.metadata);
      const nextMetadata = {
        ...metadata,
        custom_fields: (metadata.custom_fields ?? []).filter((_, itemIndex) => itemIndex !== index),
      };

      return {
        ...current,
        business_profile: {
          ...draft,
          content: buildBusinessProfileContent(nextMetadata),
          metadata: nextMetadata,
        },
      };
    });
  }

  function businessProfileEditor() {
    const draft = assetDrafts.business_profile;
    const metadata = getBusinessProfileMetadata(draft.metadata);

    return (
      <div className="grid gap-5">
        <div>
          <h3 className="text-sm font-semibold">Info del negocio</h3>
          <p className="mt-1 text-sm text-[#647067]">
            Completa estos datos como en GHL. Cada campo se puede usar como
            variable en los prompts de agentes.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {businessProfileFields.map((field) => {
            const fieldValue = metadata.fields?.[field.key] ?? "";
            const isTimeZone = field.key === "timezone" && timeZoneOptions.length > 0;
            const unknownTimeZone =
              isTimeZone && fieldValue && !timeZoneOptions.includes(fieldValue);

            return (
              <label className="grid gap-1.5 text-sm font-medium" key={field.key}>
                <span className="flex items-center justify-between gap-2">
                  {field.label}
                  <code className="rounded-md bg-[#eef2eb] px-1.5 py-0.5 text-[11px] font-normal text-[#4d5a51]">
                    {field.variable}
                  </code>
                </span>
                {isTimeZone ? (
                  <select
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                    onChange={(event) =>
                      updateBusinessField(field.key, event.target.value)
                    }
                    value={fieldValue}
                  >
                    <option value="">Sin zona horaria</option>
                    {unknownTimeZone ? (
                      <option value={fieldValue}>{fieldValue} (no reconocida)</option>
                    ) : null}
                    {timeZoneOptions.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                    onChange={(event) =>
                      updateBusinessField(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    value={fieldValue}
                  />
                )}
                <span
                  className={`text-xs font-normal ${
                    unknownTimeZone ? "text-[#a8442c]" : "text-[#647067]"
                  }`}
                >
                  {unknownTimeZone
                    ? `"${fieldValue}" no es una zona horaria valida y se ignora al agendar. Elige una de la lista.`
                    : field.help}
                </span>
              </label>
            );
          })}
        </div>

        <div className="grid gap-3 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Campos adicionales</h3>
              <p className="mt-1 text-sm text-[#647067]">
                Agrega cualquier dato propio del negocio y usalo como variable.
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium"
              onClick={addBusinessCustomField}
              type="button"
            >
              <Plus size={15} />
              Agregar campo
            </button>
          </div>

          <div className="grid gap-2">
            {(metadata.custom_fields ?? []).map((field, index) => {
              const variableKey = normalizeVariableKey(field.key || field.label);

              return (
                <div
                  className="grid gap-2 rounded-lg border border-[#e2e6df] bg-white p-3"
                  key={`${index}-${field.key}`}
                >
                  <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Nombre visible
                      <input
                        className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                        onChange={(event) =>
                          updateBusinessCustomField(index, {
                            label: event.target.value,
                          })
                        }
                        placeholder="Ej: Garantia"
                        value={field.label}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Variable
                      <input
                        className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                        onChange={(event) =>
                          updateBusinessCustomField(index, {
                            key: normalizeVariableKey(event.target.value),
                          })
                        }
                        placeholder="garantia"
                        value={field.key}
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Valor
                    <textarea
                      className="min-h-20 rounded-lg border border-[#cbd2c6] p-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                      onChange={(event) =>
                        updateBusinessCustomField(index, {
                          value: event.target.value,
                        })
                      }
                      placeholder="Ej: 30 dias para cambios por defectos de fabrica."
                      value={field.value}
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="rounded-md bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                      {variableKey ? `{${variableKey}}` : "{variable}"}
                    </code>
                    <button
                      className="h-8 rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-700"
                      onClick={() => removeBusinessCustomField(index)}
                      type="button"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
            {(metadata.custom_fields ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                No hay campos adicionales. Puedes agregar politicas, promociones,
                especialidades, URLs o cualquier dato que el agente deba conocer.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-[#cbd2c6] px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
            onChange={(event) =>
              setAssetDrafts((current) => ({
                ...current,
                business_profile: {
                  ...current.business_profile,
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
            disabled={savingKey === "business_profile"}
            onClick={() => saveAsset("business_profile")}
            type="button"
          >
            {savingKey === "business_profile" ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Guardar negocio
          </button>
        </div>
      </div>
    );
  }

  function editAsset(asset: WorkspaceAsset) {
    setAssetDrafts((current) => ({
      ...current,
      [asset.kind]: {
        content: asset.content,
        id: asset.id,
        metadata: asset.metadata,
        status: asset.status,
        title: asset.title,
      },
    }));
    setStatus("");
    // El editor esta arriba de la lista: sin esto el usuario no ve que paso.
    if (typeof window !== "undefined") {
      window.scrollTo({ behavior: "smooth", top: 0 });
    }
  }

  function assetList(kind: WorkspaceAsset["kind"], empty: string) {
    const currentAssets = assetsByKind[kind] ?? [];
    const editingId = assetDrafts[kind].id;

    return (
      <div className="grid gap-2">
        {currentAssets.map((asset) => (
          <div
            className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
              editingId === asset.id
                ? "border-[#35735b] bg-[#f3f8ee]"
                : "border-[#e2e6df]"
            }`}
            key={asset.id}
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => editAsset(asset)}
              type="button"
            >
              <p className="font-semibold">
                {asset.title}
                {editingId === asset.id ? (
                  <span className="ml-2 text-xs font-normal text-[#35735b]">
                    editando
                  </span>
                ) : null}
              </p>
              <p className="mt-1 line-clamp-2 text-[#647067]">{asset.content}</p>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                {asset.status}
              </span>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cbd2c6] bg-white px-2 text-xs font-medium text-[#10231c]"
                onClick={() => editAsset(asset)}
                type="button"
              >
                <Pencil size={13} />
                Editar
              </button>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-700 disabled:opacity-60"
                disabled={savingKey === `asset:delete:${asset.id}`}
                onClick={() => deleteAsset(asset)}
                type="button"
              >
                {savingKey === `asset:delete:${asset.id}` ? (
                  <Loader2 className="animate-spin" size={13} />
                ) : (
                  <Trash2 size={13} />
                )}
                Eliminar
              </button>
            </div>
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
    const isEditing = Boolean(draft.id) && !singletonAssetKinds.has(kind);

    return (
      <div
        className={`grid gap-3 ${
          isEditing ? "rounded-lg border border-[#35735b] bg-[#f7faf4] p-3" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              {isEditing ? `Editando: ${draft.title || "sin titulo"}` : title}
            </h3>
            <p className="mt-1 text-sm text-[#647067]">
              {isEditing
                ? "Los cambios reemplazan el documento existente."
                : helper}
            </p>
          </div>
          {isEditing ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium text-[#10231c]"
              onClick={() =>
                setAssetDrafts((current) => ({
                  ...current,
                  [kind]: {
                    content: "",
                    id: "",
                    metadata: {},
                    status: "draft",
                    title: "",
                  },
                }))
              }
              type="button"
            >
              <Plus size={15} />
              Nuevo
            </button>
          ) : null}
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
            // Solo se crea uno nuevo cuando no se esta editando ninguno. Antes
            // forzaba crear siempre, asi que editar generaba duplicados.
            onClick={() => saveAsset(kind, { forceCreate: !draft.id })}
            type="button"
          >
            {savingKey === kind ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {isEditing ? "Guardar cambios" : "Agregar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-[#d9ded3] bg-white">
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

      <div className="min-w-0 p-4">
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
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                        connected?.status === "active"
                          ? "bg-[#e7f6ce] text-[#31521d]"
                          : connected?.status === "error"
                            ? "bg-[#f8dcd6] text-[#7a2f1d]"
                            : "bg-[#eef2eb] text-[#4d5a51]"
                      }`}
                    >
                      {statusLabels[connected?.status ?? "pending"]}
                    </span>
                  </div>
                  {provider.provider === "ycloud" ? (
                    <div className="rounded-lg border border-dashed border-[#cbd2c6] bg-[#fafbf8] p-2 text-xs text-[#4d5a51]">
                      <p className="font-semibold">Webhook URL para pegar en YCloud</p>
                      <p className="mt-1 break-all">{webhookUrl}</p>
                      <p className="mt-2">
                        {ycloudSecretValue
                          ? "Esta URL usa el secreto de esta empresa."
                          : "Guarda YCloud para generar un secreto unico y pegar esta URL en YCloud."}
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
                  {provider.provider === "gohighlevel" && connected ? (
                    // El calendario se elige en Tools, no aqui: tenerlo en dos
                    // sitios creaba dos fuentes de verdad para lo mismo.
                    <p className="rounded-lg border border-dashed border-[#cbd2c6] bg-[#fafbf8] p-2 text-xs text-[#4d5a51]">
                      Los calendarios de agendamiento se configuran en la pestana{" "}
                      <span className="font-semibold">Tools</span>, y se asignan a
                      cada agente en <span className="font-semibold">Agentes</span>.
                    </p>
                  ) : null}
                  {provider.provider === "gohighlevel" && connected ? (
                    <div className="rounded-lg border border-dashed border-[#cbd2c6] bg-[#fafbf8] p-2 text-xs text-[#4d5a51]">
                      <p className="font-semibold">Webhook para pegar en GoHighLevel</p>
                      <p className="mt-1 break-all">{ghlWebhookUrl}</p>
                      <p className="mt-2">
                        En GoHighLevel: Settings &gt; Webhooks. Agrega la cabecera{" "}
                        <span className="font-semibold">Authorization: Bearer</span> con
                        este secreto:
                      </p>
                      <p className="mt-1 break-all font-semibold">
                        {ghlSecretValue || ghlSecretMask || "Sin secreto"}
                      </p>
                      <p className="mt-2">
                        {ghlSecretValue
                          ? "Copialo ahora: por seguridad no se vuelve a mostrar completo."
                          : "Solo se guarda cifrado. Si lo perdiste, genera uno nuevo (el anterior deja de servir)."}
                      </p>
                      <button
                        className="mt-2 inline-flex h-8 items-center gap-2 rounded-lg border border-[#cbd2c6] px-2 text-xs font-medium text-[#10231c] disabled:text-[#9aa59e]"
                        disabled={savingKey === "gohighlevel:secret"}
                        onClick={() =>
                          saveIntegration("gohighlevel", {
                            regenerateWebhookSecret: true,
                          })
                        }
                        type="button"
                      >
                        {savingKey === "gohighlevel:secret" ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : (
                          <KeyRound size={13} />
                        )}
                        Generar secreto nuevo
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
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
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#10231c] px-3 text-sm font-medium text-[#10231c] disabled:border-[#9aa59e] disabled:text-[#9aa59e]"
                      disabled={savingKey === `${provider.provider}:test` || !connected}
                      onClick={() => testIntegration(provider.provider)}
                      type="button"
                    >
                      {savingKey === `${provider.provider}:test` ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : provider.provider === "gohighlevel" ? (
                        <CalendarCheck size={16} />
                      ) : (
                        <PlugZap size={16} />
                      )}
                      {provider.provider === "gohighlevel"
                        ? "Probar citas"
                        : "Probar conexion"}
                    </button>
                  </div>
                  {provider.provider === "gohighlevel" &&
                  integrationTestResults.gohighlevel ? (
                    <div className="grid gap-1 border-t border-[#e2e6df] pt-3">
                      <p className="text-xs font-semibold text-[#4d5a51]">
                        Resultado de la prueba
                      </p>
                      {(integrationTestResults.gohighlevel.steps ?? []).map((step) => (
                        <div
                          className="grid min-h-7 grid-cols-[18px_minmax(0,1fr)] items-start gap-2 text-xs"
                          key={step.key}
                        >
                          {step.status === "passed" ? (
                            <Check className="mt-0.5 text-[#35735b]" size={15} />
                          ) : (
                            <CircleX className="mt-0.5 text-[#b42318]" size={15} />
                          )}
                          <p className="min-w-0 text-[#334139]">
                            <span className="font-medium">{step.label}</span>
                            {step.detail ? `: ${step.detail}` : ""}
                          </p>
                        </div>
                      ))}
                      {integrationTestResults.gohighlevel.error ? (
                        <p className="text-xs text-[#b42318]">
                          {integrationTestResults.gohighlevel.error}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {activeTab === "business" ? businessProfileEditor() : null}

        {activeTab === "tools" ? (
          <div className="grid gap-5">
            <div>
              <h3 className="text-sm font-semibold">Catalogo de Tools</h3>
              <p className="mt-1 text-sm text-[#647067]">
                Crea capacidades reutilizables y luego asignalas a cada agente.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3">
              <div>
                <h3 className="text-sm font-semibold">Calendarios de agendamiento</h3>
                <p className="mt-1 text-sm text-[#647067]">
                  Habilita los calendarios y describe cuando usar cada uno. El
                  agente elige segun lo que pida el cliente. Asignaselos en la
                  pestana Agentes.
                </p>
              </div>

              {ghlCalendars.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#d9ded3] bg-white p-3 text-sm text-[#647067]">
                  {ghlCalendarsError ||
                    "Conecta GoHighLevel en Integraciones para ver tus calendarios."}
                </p>
              ) : (
                <div className="grid gap-2">
                  {ghlCalendars.map((calendar) => {
                    const tool = calendarTools.find(
                      (item) => item.calendarId === calendar.id,
                    );

                    return (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e2e6df] bg-white p-3"
                        key={calendar.id}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {calendar.name}
                          </p>
                          {tool ? (
                            <textarea
                              className="mt-1.5 w-full rounded-lg border border-[#cbd2c6] px-2 py-1.5 text-xs outline-none focus:border-[#35735b]"
                              defaultValue={tool.description}
                              onBlur={(event) => {
                                if (event.target.value.trim() === tool.description) {
                                  return;
                                }

                                void saveCalendarTool({
                                  assetId: tool.id,
                                  calendarId: calendar.id,
                                  description: event.target.value,
                                  makeDefault: tool.isDefault,
                                });
                              }}
                              placeholder="Cuando usar esta agenda. Ej: limpiezas y revisiones generales, 30 minutos."
                              rows={2}
                            />
                          ) : (
                            <p className="mt-0.5 text-xs text-[#647067]">
                              Todavia no esta habilitado.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          {tool?.isDefault ? (
                            <span className="rounded-lg bg-[#e7f6ce] px-2 py-1 text-xs text-[#31521d]">
                              Preferida
                            </span>
                          ) : tool ? (
                            <button
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#10231c] px-3 text-sm font-medium text-[#10231c] disabled:border-[#9aa59e] disabled:text-[#9aa59e]"
                              disabled={savingKey === `calendar:${calendar.id}`}
                              onClick={() =>
                                saveCalendarTool({
                                  assetId: tool.id,
                                  calendarId: calendar.id,
                                  description: tool.description,
                                  makeDefault: true,
                                })
                              }
                              type="button"
                            >
                              {savingKey === `calendar:${calendar.id}` ? (
                                <Loader2 className="animate-spin" size={15} />
                              ) : null}
                              Marcar preferida
                            </button>
                          ) : null}
                          {!tool ? (
                            <button
                              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                              disabled={savingKey === `calendar:${calendar.id}`}
                              onClick={() =>
                                saveCalendarTool({
                                  calendarId: calendar.id,
                                  makeDefault: calendarTools.length === 0,
                                })
                              }
                              type="button"
                            >
                              <Plus size={15} />
                              Habilitar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  Personas que pueden atender chats, configurar agentes o revisar datos.
                </p>
              </div>
              <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                {localMembers.length} miembros
              </span>
            </div>
            <div className="mt-4 grid gap-3 rounded-lg border border-[#e2e6df] bg-[#fafbf8] p-3 md:grid-cols-[1fr_180px_150px_auto]">
              <label className="grid gap-1.5 text-sm font-medium">
                Email
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="persona@empresa.com"
                  type="email"
                  value={memberEmail}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Contrasena temporal
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                  minLength={8}
                  onChange={(event) => setMemberTemporaryPassword(event.target.value)}
                  placeholder="Min. 8 caracteres"
                  type="password"
                  value={memberTemporaryPassword}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Rol
                <select
                  className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                  onChange={(event) =>
                    setMemberRole(event.target.value as WorkspaceMember["role"])
                  }
                  value={memberRole}
                >
                  <option value="agent">Agente</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <button
                className="inline-flex h-10 self-end items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={savingKey === "team:add"}
                onClick={addMember}
                type="button"
              >
                {savingKey === "team:add" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Agregar
              </button>
              <label className="flex items-center gap-2 text-sm text-[#4d5a51] md:col-span-4">
                <input
                  checked={memberResetPassword}
                  className="size-4 rounded border-[#cbd2c6]"
                  onChange={(event) => setMemberResetPassword(event.target.checked)}
                  type="checkbox"
                />
                Resetear contrasena si este correo ya existe
              </label>
              <p className="text-xs text-[#647067] md:col-span-4">
                Para un usuario nuevo, la contrasena temporal es obligatoria. Para un
                usuario existente, no se cambia su contrasena salvo que marques el reset.
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-[#e2e6df] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">Cambiar mi contrasena</h4>
                  <p className="mt-1 text-sm text-[#647067]">
                    Usa tu contrasena anterior para confirmar el cambio.
                  </p>
                </div>
                <KeyRound className="shrink-0 text-[#35735b]" size={18} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="grid gap-1.5 text-sm font-medium">
                  Contrasena actual
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Actual"
                    type="password"
                    value={currentPassword}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Nueva contrasena
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Min. 8 caracteres"
                    type="password"
                    value={newPassword}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Confirmar nueva
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
                    minLength={8}
                    onChange={(event) =>
                      setNewPasswordConfirmation(event.target.value)
                    }
                    placeholder="Repite la nueva"
                    type="password"
                    value={newPasswordConfirmation}
                  />
                </label>
                <button
                  className="inline-flex h-10 self-end items-center justify-center gap-2 rounded-lg border border-[#10231c] px-3 text-sm font-medium text-[#10231c] disabled:border-[#9aa59e] disabled:text-[#9aa59e]"
                  disabled={savingKey === "team:password"}
                  onClick={changeOwnPassword}
                  type="button"
                >
                  {savingKey === "team:password" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  Cambiar
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {localMembers.map((member) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e2e6df] p-3 text-sm"
                  key={member.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.display_name || member.display_email || member.user_id}
                    </p>
                    <p className="mt-1 text-xs text-[#647067]">
                      {member.display_email || member.user_id} - Alta{" "}
                      {stableDate(member.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canChangeMemberRoles ? (
                      <select
                        aria-label={`Permiso de ${member.display_email || member.user_id}`}
                        className="h-9 rounded-lg border border-[#cbd2c6] bg-white px-2 text-xs font-semibold text-[#31521d] outline-none focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50 disabled:bg-[#eef2eb] disabled:text-[#7b877e]"
                        disabled={savingKey === `team:role:${member.id}`}
                        onChange={(event) =>
                          updateMemberRole(
                            member,
                            event.target.value as WorkspaceMember["role"],
                          )
                        }
                        value={member.role}
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="agent">agent</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <span className="rounded-lg bg-[#e7f6ce] px-2 py-1 text-xs text-[#31521d]">
                        {member.role}
                      </span>
                    )}
                    {savingKey === `team:role:${member.id}` ? (
                      <Loader2 className="animate-spin text-[#35735b]" size={14} />
                    ) : null}
                    <button
                      className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-lg border border-[#efc4bd] bg-[#fff3f1] px-3 text-xs font-semibold text-[#9b2f22] shadow-sm transition hover:border-[#d96c5e] hover:bg-[#ffe4df] hover:text-[#7f2419] focus:outline-none focus:ring-2 focus:ring-[#f5b6ad]/60 disabled:cursor-not-allowed disabled:border-[#e4dfdb] disabled:bg-[#f6f4f1] disabled:text-[#9aa59e] disabled:shadow-none"
                      disabled={savingKey === `team:remove:${member.id}`}
                      onClick={() => removeMember(member)}
                      type="button"
                    >
                      {savingKey === `team:remove:${member.id}` ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {localMembers.length === 0 ? (
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
