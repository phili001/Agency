import "server-only";

import { forbidden, unauthorized } from "@/lib/api-error";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspaces";

/**
 * Acceso reservado a diagnostico/operacion: o viene con el CRON_SECRET, o es un
 * superadmin con sesion. Estos endpoints exponen que variables de entorno estan
 * puestas y que tablas fallan, asi que no pueden ser publicos.
 */
export async function isOperatorRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return await isPlatformAdmin(user);
  } catch {
    return false;
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw unauthorized();
  }

  return { supabase, user };
}

export async function requireWorkspaceRole(
  workspaceId: string,
  allowedRoles: string[] = ["owner", "admin"],
) {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw forbidden();
  }

  return { role: membership.role, supabase, user };
}

/**
 * La empresa activa del panel (cookie `active_workspace_id`, validada contra
 * las membresías del usuario) y su rol en ella. Para las rutas nuevas del CRM:
 * así el `workspaceId` nunca viene del cuerpo o la query que manda el navegador.
 */
export async function requireActiveWorkspaceRole(allowedRoles: string[] = ["owner", "admin"]) {
  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const rows = (memberships ?? []) as Array<{ role: string; workspace_id: string }>;
  const workspaceId = await getActiveWorkspaceId(rows.map((row) => row.workspace_id));
  const role = rows.find((row) => row.workspace_id === workspaceId)?.role;

  if (!workspaceId || !role || !allowedRoles.includes(role)) {
    throw forbidden();
  }

  return { role, supabase, user, workspaceId };
}
