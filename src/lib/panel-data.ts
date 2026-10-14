import "server-only";

import {
  DEFAULT_AGENT_PROMPT_VERSION,
  buildDefaultAgentConfig,
  buildDefaultAgentPrompt,
  defaultAgentPresets,
} from "@/lib/default-agents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

const deployChecks = [
  {
    description: "Base de datos y autenticacion disponibles",
    envKeys: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    label: "Datos",
  },
  {
    description: "Llave maestra para proteger API keys por empresa",
    envKeys: ["INTEGRATION_ENCRYPTION_KEY"],
    label: "OpenAI",
  },
  {
    description: "Endpoint público para recibir mensajes",
    envKeys: ["NEXT_PUBLIC_APP_URL"],
    label: "YCloud API",
  },
  {
    description: "Protección de cron buffer/deliver",
    envKeys: ["CRON_SECRET"],
    label: "Cron secret",
  },
  {
    description: "Dominio público para webhooks",
    envKeys: ["NEXT_PUBLIC_APP_URL"],
    label: "App URL",
  },
  {
    description: "Sincronización de contactos/leads por empresa",
    envKeys: ["INTEGRATION_ENCRYPTION_KEY"],
    label: "GoHighLevel",
  },
];

export type AppSection =
  | "agents"
  | "automations"
  | "business"
  | "clients"
  | "dashboard"
  | "flows"
  | "integrations"
  | "knowledge"
  | "observability"
  | "team"
  | "templates"
  | "tools";

export const workspaceTabs = [
  "agents",
  "automations",
  "business",
  "integrations",
  "knowledge",
  "team",
  "templates",
  "tools",
] as const;

export const sectionTitles: Record<AppSection, { eyebrow: string; title: string }> = {
  agents: { eyebrow: "Workspace", title: "Agentes" },
  automations: { eyebrow: "Workspace", title: "Automatizaciones" },
  business: { eyebrow: "Workspace", title: "Negocio" },
  clients: { eyebrow: "CRM", title: "Clientes" },
  dashboard: { eyebrow: "Operaciones", title: "Dashboard de agentes de WhatsApp" },
  flows: { eyebrow: "Workspace", title: "Flujos" },
  integrations: { eyebrow: "Workspace", title: "Integraciones" },
  knowledge: { eyebrow: "Workspace", title: "Knowledge Base" },
  observability: { eyebrow: "Sistema", title: "Observabilidad" },
  team: { eyebrow: "Workspace", title: "Equipo" },
  templates: { eyebrow: "Workspace", title: "Templates" },
  tools: { eyebrow: "Workspace", title: "Tools" },
};

export function stableTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}

export function stableNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function getContactMetadata(
  metadata: unknown,
  automationLabels: string[] = [],
  messagingStatus: string = "active",
  pendingReview?: Record<string, unknown> | null,
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const ycloud =
    record.ycloud && typeof record.ycloud === "object" && !Array.isArray(record.ycloud)
      ? (record.ycloud as Record<string, unknown>)
      : {};
  const flowProgress =
    record.flow_progress &&
    typeof record.flow_progress === "object" &&
    !Array.isArray(record.flow_progress)
      ? (record.flow_progress as Record<string, unknown>)
      : undefined;

  return {
    ai_summary:
      typeof record.ai_summary === "string" ? record.ai_summary : undefined,
    ai_tags: Array.isArray(record.ai_tags)
      ? record.ai_tags.filter((tag: unknown): tag is string => typeof tag === "string")
      : undefined,
    automation_labels: automationLabels,
    flow_progress: flowProgress
      ? {
          completedStageKeys: Array.isArray(flowProgress.completedStageKeys)
            ? flowProgress.completedStageKeys.filter(
                (item): item is string => typeof item === "string",
              )
            : undefined,
          completedStepIds: Array.isArray(flowProgress.completedStepIds)
            ? flowProgress.completedStepIds.filter(
                (item): item is string => typeof item === "string",
              )
            : undefined,
          completedSteps:
            typeof flowProgress.completedSteps === "number"
              ? flowProgress.completedSteps
              : undefined,
          currentStageKey:
            typeof flowProgress.currentStageKey === "string"
              ? flowProgress.currentStageKey
              : undefined,
          currentStageLabel:
            typeof flowProgress.currentStageLabel === "string"
              ? flowProgress.currentStageLabel
              : undefined,
          flowId:
            typeof flowProgress.flowId === "string" ? flowProgress.flowId : undefined,
          totalSteps:
            typeof flowProgress.totalSteps === "number"
              ? flowProgress.totalSteps
              : undefined,
          updatedAt:
            typeof flowProgress.updatedAt === "string"
              ? flowProgress.updatedAt
              : undefined,
        }
      : undefined,
    ghl_contact_id:
      typeof record.ghl_contact_id === "string" ? record.ghl_contact_id : undefined,
    ghl_last_error:
      typeof record.ghl_last_error === "string" ? record.ghl_last_error : undefined,
    ghl_synced_at:
      typeof record.ghl_synced_at === "string" ? record.ghl_synced_at : undefined,
    messaging_status:
      messagingStatus === "blocked" ? ("blocked" as const) : ("active" as const),
    pending_review: pendingReview
      ? {
          attempt_count: Number(pendingReview.attempt_count ?? 0),
          created_at: String(pendingReview.created_at ?? ""),
          id: String(pendingReview.id ?? ""),
          original_answer: String(pendingReview.original_answer ?? ""),
          question: String(pendingReview.question ?? ""),
          validation_reason: String(pendingReview.validation_reason ?? ""),
        }
      : undefined,
    ycloud_contact_name:
      typeof ycloud.contact_name === "string" ? ycloud.contact_name : undefined,
  };
}

function getAuthDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Usuario";
}

export async function getMemberProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { email: string; name: string }>();
  }

  try {
    const admin = createAdminClient();
    const entries = await Promise.all(
      [...new Set(userIds)].map(async (userId) => {
        const { data } = await admin.auth.admin.getUserById(userId);
        const user = data.user;

        if (!user) {
          return null;
        }

        return [
          userId,
          {
            email: user.email ?? "",
            name: getAuthDisplayName({
              email: user.email ?? "",
              user_metadata: user.user_metadata,
            }),
          },
        ] as const;
      }),
    );

    return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)));
  } catch {
    return new Map<string, { email: string; name: string }>();
  }
}

function getConfigRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Lleva los agentes por defecto no personalizados a la ultima version del
 * prompt base. Devuelve cuantos actualizo, para que quien muestre agentes
 * pueda leerlos en paralelo y releer solo si algo cambio.
 */
export async function syncDefaultAgentPrompts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<number> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, type, model, config, system_prompt, temperature")
    .eq("workspace_id", workspaceId);

  if (!agents?.length) {
    return 0;
  }

  const results = await Promise.all(
    agents.map((agent) => {
      const config = getConfigRecord(agent.config);
      const preset = defaultAgentPresets.find(
        (item) => item.key === config.default_agent_key,
      );
      const currentVersion = Number(config.default_agent_prompt_version ?? 0);
      const isCustomized = config.onboarding_agent_configured === true;
      const alreadyUsesBusinessVariables =
        typeof agent.system_prompt === "string" &&
        agent.system_prompt.includes("{company_name}") &&
        agent.system_prompt.includes("{business_hours}") &&
        agent.system_prompt.includes("{location}");
      const alreadyMatchesPreset =
        agent.name === preset?.name &&
        agent.type === preset?.type &&
        agent.model === "gpt-4o-mini";

      if (
        !preset ||
        isCustomized ||
        (currentVersion >= DEFAULT_AGENT_PROMPT_VERSION &&
          alreadyUsesBusinessVariables &&
          alreadyMatchesPreset)
      ) {
        return Promise.resolve(false);
      }

      const defaults = buildDefaultAgentConfig(preset);

      return supabase
        .from("agents")
        .update({
          config: {
            ...defaults,
            ...config,
            agent_name: preset.agentName,
            default_agent_key: preset.key,
            default_agent_prompt_version: DEFAULT_AGENT_PROMPT_VERSION,
            job_title: preset.jobTitle,
            router_description: preset.routerDescription,
          },
          model: "gpt-4o-mini",
          name: preset.name,
          system_prompt: buildDefaultAgentPrompt(preset),
          // El tono lo elige el cliente en el onboarding: no se reescribe.
          temperature: agent.temperature ?? 0.3,
          type: preset.type,
        })
        .eq("id", agent.id)
        .eq("workspace_id", workspaceId)
        .then(({ error }) => !error);
    }),
  );

  return results.filter(Boolean).length;
}

/** Variables de entorno que el panel comprueba antes de ir a produccion. */
export function getDeployReadiness() {
  const checks = deployChecks.map((check) => ({
    ...check,
    ready: check.envKeys.every((key) => Boolean(process.env[key])),
  }));

  return { checks, ready: checks.filter((check) => check.ready).length };
}
