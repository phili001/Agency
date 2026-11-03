import { ContactsPanel } from "@/components/crm/contacts-panel";
import type { ContactListItem, CrmPanelOptions } from "@/components/crm/types";
import { PanelPage } from "@/components/panel/panel-header";
import { searchContacts } from "@/lib/crm/contacts";
import { listCustomFields } from "@/lib/crm/custom-fields";
import { listStages } from "@/lib/crm/stages";
import { listTags } from "@/lib/crm/tags";
import { getPanelContext } from "@/lib/panel-context";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Clientes = CRM de la empresa: lista con filtros, vista por etapas y ficha.
 * Se amplía esta página en vez de crear `/contactos` para no tocar el menú
 * lateral (decisión del usuario; ver PROGRESO_CRM_SUPABASE.md, F5.5).
 */
export default async function ClientsPage() {
  const { activeRole, workspace, workspaceId } = await getPanelContext();
  const admin = createAdminClient();
  const [initial, stages, tags, customFields] = workspaceId
    ? await Promise.all([
        searchContacts(admin, workspaceId, { pageSize: 25 }),
        listStages(admin, workspaceId),
        listTags(admin, workspaceId),
        listCustomFields(admin, workspaceId),
      ])
    : [{ contacts: [], total: 0 }, [], [], []];
  const options: CrmPanelOptions = { customFields, stages, tags };

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="clients">
      {workspaceId ? (
        <ContactsPanel
          canManage={activeRole === "owner" || activeRole === "admin"}
          initial={{ contacts: initial.contacts as ContactListItem[], total: initial.total }}
          options={options}
        />
      ) : null}
    </PanelPage>
  );
}
