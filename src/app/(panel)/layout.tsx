import { BrandMark } from "@/components/brand/public-shell";
import { BillingNotice } from "@/components/panel/billing-notice";
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
  const { activeRole, platformAdmin, roleByWorkspaceId, user, workspaceId, workspaces } =
    await getPanelContext();
  const workspaceOptions = workspaces.map((item) => ({
    companyCode: typeof item.company_code === "string" ? item.company_code : null,
    id: item.id,
    name: item.name,
    role: roleByWorkspaceId.get(item.id) ?? "viewer",
    slug: item.slug,
  }));

  return (
    <main className="min-h-screen bg-paper-2 text-ink">
      {/* minmax(0,1fr): una tabla o un texto largo no puede ensanchar la página. */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Fija al hacer scroll y con scroll propio: en un portátil de 768 px de
            alto el menú completo no cabe. */}
        <aside className="border-b border-line bg-paper-2 p-5 text-ink lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <BrandMark tag="Agentes" />

          <SidebarNav platformAdmin={platformAdmin} />

          <div className="mt-8 border-t border-line pt-5">
            <WorkspaceSwitcher
              activeWorkspaceId={workspaceId ?? null}
              workspaces={workspaceOptions}
            />
            <p className="mt-3 text-xs text-muted">{user.email}</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          {workspaceId ? <BillingNotice role={activeRole} workspaceId={workspaceId} /> : null}
          {children}
        </section>
      </div>
    </main>
  );
}
