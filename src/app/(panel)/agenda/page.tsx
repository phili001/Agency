import { AgendaPanel } from "@/components/agenda/agenda-panel";
import type { AgendaItem } from "@/components/agenda/types";
import { PanelPage } from "@/components/panel/panel-header";
import { listAgendas, withoutConfig } from "@/lib/agenda/agendas";
import { getPanelContext } from "@/lib/panel-context";
import { createAdminClient } from "@/lib/supabase/admin";

/** Agenda propia: citas por semana/día, bloqueos y configuración de cada agenda. */
export default async function AgendaPage() {
  const { activeRole, workspace, workspaceId } = await getPanelContext();
  const agendas = workspaceId ? await listAgendas(createAdminClient(), workspaceId) : [];

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="agenda">
      {workspaceId ? (
        <AgendaPanel
          canEdit={["owner", "admin", "agent"].includes(activeRole)}
          canManage={activeRole === "owner" || activeRole === "admin"}
          initialAgendas={agendas.map(withoutConfig) as unknown as AgendaItem[]}
        />
      ) : null}
    </PanelPage>
  );
}
