import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/wizard";
import { normalizeAppUrl } from "@/lib/app-url";
import { getDefaultConversationMode } from "@/lib/conversation-default";
import { getIntegrationSecret } from "@/lib/integrations/secrets";
import { getFirstPendingStep, parseStepIndex } from "@/lib/onboarding-steps";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId, getOnboardingChecklist } from "@/lib/workspaces";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const workspaceIds = (memberships ?? []).map((item) => item.workspace_id);

  if (workspaceIds.length === 0) {
    if (await isPlatformAdmin(user)) {
      redirect("/admin");
    }

    redirect(
      `/login?error=${encodeURIComponent(
        "Tu usuario aun no tiene una empresa asignada. Pide al administrador que cree o vincule tu empresa.",
      )}`,
    );
  }

  const workspaceId = await getActiveWorkspaceId(workspaceIds);

  if (!workspaceId) {
    redirect("/");
  }

  // Solo owner/admin configuran; el resto del equipo va directo a la bandeja.
  const role = memberships?.find((item) => item.workspace_id === workspaceId)?.role;

  if (!role || !["owner", "admin"].includes(role)) {
    redirect("/");
  }

  const [
    { data: workspace },
    { data: integrations },
    { data: assets },
    { data: agents },
    { data: members },
    checklist,
    webhookSecret,
  ] = await Promise.all([
    admin.from("workspaces").select("*").eq("id", workspaceId).single(),
    supabase
      .from("integrations")
      .select("provider, status, config")
      .eq("workspace_id", workspaceId),
    supabase
      .from("workspace_assets")
      .select("id, kind, title, content, metadata, status")
      .eq("workspace_id", workspaceId)
      .eq("kind", "business_profile"),
    supabase
      .from("agents")
      .select("id, name, type, config")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    admin.from("workspace_members").select("id").eq("workspace_id", workspaceId),
    getOnboardingChecklist(workspaceId),
    getIntegrationSecret({ kind: "webhook_secret", provider: "ycloud", workspaceId }),
  ]);

  if (!workspace) {
    redirect("/");
  }

  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  const companyCode =
    "company_code" in workspace && typeof workspace.company_code === "string"
      ? workspace.company_code
      : null;
  const webhookUrl = webhookSecret
    ? `${appUrl}/api/webhooks/ycloud/${companyCode ?? workspace.id}/${encodeURIComponent(webhookSecret)}`
    : null;
  const requestedStep = parseStepIndex((await searchParams).paso);

  return (
    <OnboardingWizard
      agents={(agents ?? []) as never}
      appUrl={appUrl}
      businessProfile={assets?.[0] ?? null}
      checklist={checklist}
      defaultConversationMode={getDefaultConversationMode(workspace.onboarding_state)}
      initialStep={requestedStep ?? getFirstPendingStep(checklist).index}
      integrations={(integrations ?? []) as never}
      memberCount={members?.length ?? 1}
      webhookUrl={webhookUrl}
      workspace={{ company_code: companyCode, id: workspace.id, name: workspace.name }}
    />
  );
}
