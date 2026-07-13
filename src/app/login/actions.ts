"use server";

import { redirect } from "next/navigation";

import { isPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { setActiveWorkspaceId } from "@/lib/workspaces";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const user = data.user;
  if (await isPlatformAdmin(user)) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (!memberships?.length) {
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent(
        "Tu usuario aun no tiene una empresa asignada. Pide al administrador que cree o vincule tu empresa.",
      )}`,
    );
  }

  const workspaceIds = memberships.map((membership) => membership.workspace_id);
  const canConfigureOnboarding = memberships.some((membership) =>
    ["owner", "admin"].includes(membership.role),
  );
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);
  const hasCompletedWorkspace = (workspaces ?? []).some(
    (workspace) =>
      "onboarding_completed_at" in workspace && Boolean(workspace.onboarding_completed_at),
  );
  const preferredWorkspaceId =
    (workspaces ?? []).find(
      (workspace) =>
        "onboarding_completed_at" in workspace && Boolean(workspace.onboarding_completed_at),
    )?.id ?? workspaceIds[0];

  await setActiveWorkspaceId(preferredWorkspaceId);

  if (!hasCompletedWorkspace && canConfigureOnboarding) {
    redirect("/onboarding");
  }

  redirect("/");
}

export async function signUp() {
  redirect(
    `/login?error=${encodeURIComponent(
      "Las cuentas se crean desde la consola superadmin. Pide al administrador que cree tu empresa.",
    )}`,
  );
}
