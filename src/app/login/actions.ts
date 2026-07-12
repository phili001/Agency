"use server";

import { redirect } from "next/navigation";

import { isPlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

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

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1);

  if (!memberships?.length) {
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent(
        "Tu usuario aun no tiene una empresa asignada. Pide al administrador que cree o vincule tu empresa.",
      )}`,
    );
  }

  const workspaceIds = memberships.map((membership) => membership.workspace_id);
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);
  const hasCompletedWorkspace = (workspaces ?? []).some(
    (workspace) =>
      "onboarding_completed_at" in workspace && Boolean(workspace.onboarding_completed_at),
  );

  if (!hasCompletedWorkspace) {
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
