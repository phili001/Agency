import "server-only";

import { forbidden } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";

type UserLike = {
  app_metadata?: Record<string, unknown>;
  email?: string | null;
};

export function getBootstrapSuperadminEmails() {
  return (process.env.SUPERADMIN_EMAILS ?? "mejora@agentedavidsegura.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(user: UserLike | null | undefined) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  if (getBootstrapSuperadminEmails().includes(email)) {
    return true;
  }

  if (user?.app_metadata?.platform_admin === true) {
    return true;
  }

  const admin = createAdminClient();
  const authUser = await findAuthUserForPlatformAdmin(admin, email);

  return authUser?.app_metadata?.platform_admin === true;
}

export async function requirePlatformAdmin(user: UserLike | null | undefined) {
  if (!(await isPlatformAdmin(user))) {
    throw forbidden("Necesitas permisos de superadmin para esta acción.");
  }
}

async function findAuthUserForPlatformAdmin(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      return null;
    }

    const user = data.users.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user || data.users.length < 100) {
      return user ?? null;
    }

    page += 1;
  }

  return null;
}
