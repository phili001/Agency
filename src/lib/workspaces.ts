import "server-only";

import { cookies } from "next/headers";

import {
  buildDefaultAgentConfig,
  buildDefaultAgentPrompt,
  defaultAgentPresets,
} from "@/lib/default-agents";
import {
  type OnboardingChecklist,
  getOnboardingState,
} from "@/lib/onboarding-steps";
import { createAdminClient } from "@/lib/supabase/admin";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

type UserLike = {
  email?: string | null;
  id: string;
  user_metadata?: Record<string, unknown>;
};

export type { OnboardingChecklist };

export const COMPANY_CODE_PATTERN = /^[A-Z]{3}[0-9]{3}$/;

export function incrementCompanyCode(code: string) {
  if (!COMPANY_CODE_PATTERN.test(code)) {
    return "AAA001";
  }

  const letters = code.slice(0, 3).split("");
  const number = Number(code.slice(3));

  if (number < 999) {
    return `${letters.join("")}${String(number + 1).padStart(3, "0")}`;
  }

  for (let index = letters.length - 1; index >= 0; index -= 1) {
    if (letters[index] !== "Z") {
      letters[index] = String.fromCharCode(letters[index].charCodeAt(0) + 1);

      for (let resetIndex = index + 1; resetIndex < letters.length; resetIndex += 1) {
        letters[resetIndex] = "A";
      }

      return `${letters.join("")}001`;
    }
  }

  throw new Error("Se agotaron los códigos de empresa disponibles.");
}

export async function generateNextCompanyCode() {
  const admin = createAdminClient();
  const { data: workspaces, error } = await admin
    .from("workspaces")
    .select("*")
    .order("company_code", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const currentCode =
    workspaces?.find(
      (workspace) =>
        typeof workspace.company_code === "string" &&
        COMPANY_CODE_PATTERN.test(workspace.company_code),
    )?.company_code ?? null;

  return currentCode ? incrementCompanyCode(currentCode) : "AAA001";
}

export function getDefaultWorkspaceName(user: UserLike) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || "Mi empresa";
}

export function getDefaultWorkspaceSlug(userId: string, name: string) {
  const baseSlug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "empresa";

  return `${baseSlug}-${userId.slice(0, 8)}`;
}

export async function getActiveWorkspaceId(workspaceIds: string[]) {
  const cookieStore = await cookies();
  const selected = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  return selected && workspaceIds.includes(selected) ? selected : workspaceIds[0] ?? null;
}

export async function setActiveWorkspaceId(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function createWorkspaceForUser(user: UserLike, name: string) {
  const admin = createAdminClient();
  const cleanName = name.trim() || getDefaultWorkspaceName(user);
  const companyCode = await generateNextCompanyCode();
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({
      company_code: companyCode,
      name: cleanName,
      owner_id: user.id,
      slug: getDefaultWorkspaceSlug(user.id, cleanName),
    })
    .select("*")
    .single();

  if (workspaceError || !workspace) {
    throw workspaceError ?? new Error("No se pudo crear la empresa.");
  }

  const { error: memberError } = await admin.from("workspace_members").insert({
    role: "owner",
    user_id: user.id,
    workspace_id: workspace.id,
  });

  if (memberError) {
    throw memberError;
  }

  await admin.from("agents").insert(
    defaultAgentPresets.map((preset) => ({
      config: buildDefaultAgentConfig(preset),
      is_active: true,
      model: "gpt-4o-mini",
      name: preset.name,
      system_prompt: buildDefaultAgentPrompt(preset),
      temperature: 0.3,
      type: preset.type,
      workspace_id: workspace.id,
    })),
  );

  await setActiveWorkspaceId(workspace.id);

  return workspace;
}

export function isChecklistComplete(checklist: OnboardingChecklist) {
  return (
    checklist.openaiReady &&
    checklist.ycloudReady &&
    checklist.businessReady &&
    checklist.agentReady &&
    checklist.firstSignalReady
  );
}

function isAgentConfiguredForOnboarding(config: unknown) {
  return (
    Boolean(config) &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    (config as Record<string, unknown>).onboarding_agent_configured === true
  );
}

export async function getOnboardingChecklist(workspaceId: string) {
  const admin = createAdminClient();
  const [
    { data: integrations },
    { data: businessProfile },
    { data: agents },
    { data: members },
    { data: webhooks },
    { data: sentMessages },
    { data: workspace },
  ] = await Promise.all([
    admin
      .from("integrations")
      .select("provider, status")
      .eq("workspace_id", workspaceId),
    admin
      .from("workspace_assets")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("kind", "business_profile")
      .eq("status", "active")
      .limit(1),
    admin
      .from("agents")
      .select("id, config")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .limit(10),
    admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId),
    admin
      .from("webhook_events")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "stored")
      .limit(1),
    admin
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("direction", "outbound")
      .in("status", ["queued", "sent"])
      .limit(1),
    admin
      .from("workspaces")
      .select("onboarding_state")
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);
  const activeProviders = new Set(
    (integrations ?? [])
      .filter((integration) => integration.status === "active")
      .map((integration) => integration.provider),
  );

  // El wizard deja "confirmar" los agentes por defecto sin editarlos: si se
  // marcaran como personalizados dejarian de recibir mejoras del prompt base.
  const agentsConfirmed = Boolean(
    getOnboardingState(workspace?.onboarding_state).agents_confirmed_at,
  );

  return {
    agentReady:
      agentsConfirmed ||
      Boolean(agents?.some((agent) => isAgentConfiguredForOnboarding(agent.config))),
    businessReady: Boolean(businessProfile?.length),
    firstSignalReady: Boolean(webhooks?.length || sentMessages?.length),
    openaiReady: activeProviders.has("openai"),
    teamReady: (members?.length ?? 0) > 1,
    ycloudReady: activeProviders.has("ycloud"),
  } satisfies OnboardingChecklist;
}
