import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { isPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspaces";

/**
 * Quien esta mirando el panel y en que empresa. Lo piden el layout (sidebar)
 * y cada pagina (permisos y datos): `cache` hace que en una misma peticion se
 * resuelva una sola vez. En una navegacion interna el layout no se vuelve a
 * renderizar, asi que solo lo paga la pagina.
 *
 * Cada pagina debe llamarlo: el layout no protege a las paginas por si solo.
 */
export const getPanelContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const [platformAdmin, { data: memberships, error: membershipError }] =
    await Promise.all([
      isPlatformAdmin(user),
      admin
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

  if (membershipError || !memberships?.length) {
    if (platformAdmin) {
      redirect("/admin");
    }

    redirect(
      `/login?error=${encodeURIComponent(
        "Tu usuario aun no tiene una empresa asignada. Pide al administrador que cree o vincule tu empresa.",
      )}`,
    );
  }

  const workspaceIds = memberships.map((item) => item.workspace_id);
  const workspaceId = await getActiveWorkspaceId(workspaceIds);
  // Una sola lectura sirve para el selector de empresa y para la activa.
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds)
    .order("created_at", { ascending: false });
  const roleByWorkspaceId = new Map(
    memberships.map((item) => [item.workspace_id, item.role]),
  );
  const workspace = workspaces?.find((item) => item.id === workspaceId) ?? null;

  return {
    activeRole: workspaceId
      ? roleByWorkspaceId.get(workspaceId) ?? "viewer"
      : "sin acceso",
    platformAdmin,
    roleByWorkspaceId,
    supabase,
    user,
    workspace,
    workspaceCode:
      workspace && typeof workspace.company_code === "string"
        ? workspace.company_code
        : null,
    workspaceId,
    workspaceIds,
    workspaces: workspaces ?? [],
  };
});

export type PanelContext = Awaited<ReturnType<typeof getPanelContext>>;
