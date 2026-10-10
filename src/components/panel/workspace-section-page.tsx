import { PanelPage } from "@/components/panel/panel-header";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { normalizeAppUrl } from "@/lib/app-url";
import { getDefaultConversationMode } from "@/lib/conversation-default";
import { getPanelContext } from "@/lib/panel-context";
import {
  getMemberProfiles,
  syncDefaultAgentPrompts,
  type workspaceTabs,
} from "@/lib/panel-data";

const emptyResult = { data: [], error: null };

async function loadAgents(
  supabase: Awaited<ReturnType<typeof getPanelContext>>["supabase"],
  workspaceId: string,
) {
  return supabase
    .from("agents")
    .select(
      "id, workspace_id, name, type, is_active, model, system_prompt, temperature, config",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
}

/** Agentes, Integraciones, Negocio, Tools, Templates, KB, Equipo y Automatizaciones. */
export async function WorkspaceSectionPage({
  tab,
}: {
  tab: (typeof workspaceTabs)[number];
}) {
  const { activeRole, supabase, user, workspace, workspaceCode, workspaceId } =
    await getPanelContext();
  const [syncedAgents, agentsResult, integrationsResult, membersResult, assetsResult] =
    workspaceId
      ? await Promise.all([
          syncDefaultAgentPrompts(supabase, workspaceId),
          loadAgents(supabase, workspaceId),
          supabase
            .from("integrations")
            .select("id, workspace_id, provider, status, config, secret_ref, last_error")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false }),
          // Los miembros solo se muestran en Equipo, y cada uno cuesta una
          // llamada a Auth para el nombre: no se piden en las demas pestañas.
          tab === "team"
            ? supabase
                .from("workspace_members")
                .select("id, workspace_id, user_id, role, created_at")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: true })
            : Promise.resolve(emptyResult),
          supabase
            .from("workspace_assets")
            .select("id, workspace_id, kind, title, content, status, metadata")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false }),
        ])
      : [0, emptyResult, emptyResult, emptyResult, emptyResult];
  // Si la sincronizacion cambio algun prompt, la lectura paralela pudo llegar
  // antes: se relee para no enseñar el prompt viejo.
  const agents =
    (syncedAgents > 0 && workspaceId
      ? (await loadAgents(supabase, workspaceId)).data
      : agentsResult.data) ?? [];
  const members = membersResult.data ?? [];
  const memberProfiles = await getMemberProfiles(members.map((member) => member.user_id));
  const displayMembers = members.map((member) => {
    const profile = memberProfiles.get(member.user_id);

    return {
      ...member,
      display_email: profile?.email ?? "",
      display_name: profile?.name ?? member.user_id,
    };
  });

  return (
    <PanelPage
      hasWorkspace={Boolean(workspace)}
      section={tab}
      tourKey={tab === "agents" ? "agents" : null}
      userMetadata={user.user_metadata}
    >
      <WorkspaceSettings
        activeRole={activeRole}
        agents={agents}
        appUrl={normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)}
        assets={assetsResult.data ?? []}
        defaultConversationMode={getDefaultConversationMode(
          workspace?.onboarding_state,
        )}
        initialTab={tab}
        integrations={integrationsResult.data ?? []}
        members={displayMembers}
        showNavigation={false}
        workspaceCode={workspaceCode}
        workspaceId={workspaceId ?? null}
        workspaceName={workspace?.name ?? "Workspace"}
      />
    </PanelPage>
  );
}
