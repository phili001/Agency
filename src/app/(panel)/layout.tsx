import { Bot } from "lucide-react";

import { SidebarNav } from "@/components/panel/sidebar-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { getPanelContext } from "@/lib/panel-context";

/**
 * Marco comun de las secciones del panel. Al navegar entre secciones Next solo
 * vuelve a renderizar la pagina: el sidebar, la sesion y la lista de empresas
 * no se recalculan, y mientras carga la seccion nueva el sidebar sigue visible.
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { platformAdmin, roleByWorkspaceId, user, workspaceId, workspaces } =
    await getPanelContext();
  const workspaceOptions = workspaces.map((item) => ({
    companyCode: typeof item.company_code === "string" ? item.company_code : null,
    id: item.id,
    name: item.name,
    role: roleByWorkspaceId.get(item.id) ?? "viewer",
    slug: item.slug,
  }));

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-[#20231f]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d9ded3] bg-[#10231c] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#d2f36b] text-[#10231c]">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">Levy</p>
              <p className="text-xs text-[#b7c4bd]">Panel de empresas</p>
            </div>
          </div>

          <SidebarNav platformAdmin={platformAdmin} />

          <div className="mt-8 border-t border-white/10 pt-5">
            <WorkspaceSwitcher
              activeWorkspaceId={workspaceId ?? null}
              workspaces={workspaceOptions}
            />
            <p className="mt-3 text-xs text-[#b7c4bd]">{user.email}</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">{children}</section>
      </div>
    </main>
  );
}
