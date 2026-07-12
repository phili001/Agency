import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado.");
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
    throw new Error("No tienes permisos para este espacio.");
  }

  return { role: membership.role, supabase, user };
}
