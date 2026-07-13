import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId, getOnboardingChecklist } from "@/lib/workspaces";

export default async function OnboardingPage() {
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
  const { data: workspaces } = workspaceIds.length
    ? await admin
        .from("workspaces")
        .select("*")
        .in("id", workspaceIds)
    : { data: [] };
  const workspace = workspaces?.find((item) => item.id === workspaceId) ?? null;
  const [{ data: integrations }, { data: assets }, checklist] = workspaceId
    ? await Promise.all([
        supabase
          .from("integrations")
          .select("provider, status, config")
          .eq("workspace_id", workspaceId),
        supabase
          .from("workspace_assets")
          .select("id, kind, title, content, metadata, status")
          .eq("workspace_id", workspaceId),
        getOnboardingChecklist(workspaceId),
      ])
    : [{ data: [] }, { data: [] }, null];
  const businessProfile =
    assets?.find((asset) => asset.kind === "business_profile") ?? null;

  return (
    <OnboardingWizard
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      businessProfile={businessProfile}
      checklist={checklist}
      integrations={(integrations ?? []) as never}
      workspace={workspace}
      workspaceCount={workspaceIds.length}
    />
  );
}
