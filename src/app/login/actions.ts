"use server";

import { redirect } from "next/navigation";

import { normalizeAppUrl } from "@/lib/app-url";
import { translateAuthError } from "@/lib/auth-messages";
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
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
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

/**
 * Envia el correo de recuperacion. Responde siempre igual, exista o no la
 * cuenta: si no, el formulario se convierte en un detector de emails validos.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      `/recuperar?error=${encodeURIComponent("Escribe el email de tu cuenta.")}`,
    );
  }

  const supabase = await createClient();
  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  if (error && /rate limit|too many requests/i.test(error.message)) {
    redirect(`/recuperar?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/recuperar?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 8) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        "La contraseña debe tener mínimo 8 caracteres.",
      )}`,
    );
  }

  if (password !== confirmation) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Las dos contraseñas no coinciden.")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/recuperar?error=${encodeURIComponent(
        "El enlace caducó o ya se usó. Pide uno nuevo.",
      )}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/reset-password?error=${encodeURIComponent(translateAuthError(error.message))}`,
    );
  }

  redirect("/login?updated=1");
}
