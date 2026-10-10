import { FlowBuilder } from "@/components/flow-builder";
import { PanelPage } from "@/components/panel/panel-header";
import { getPanelContext } from "@/lib/panel-context";
import { syncDefaultAgentPrompts } from "@/lib/panel-data";

const emptyResult = { data: [], error: null };

export default async function FlujosPage() {
  const { supabase, workspace, workspaceCode, workspaceId } = await getPanelContext();
  const loadAgents = () =>
    supabase
      .from("agents")
      .select(
        "id, workspace_id, name, type, is_active, model, system_prompt, temperature, config",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
  const [syncedAgents, agentsResult, integrationsResult, flowsResult, flowRunsResult] =
    workspaceId
      ? await Promise.all([
          syncDefaultAgentPrompts(supabase, workspaceId),
          loadAgents(),
          supabase
            .from("integrations")
            .select("id, workspace_id, provider, status, config, secret_ref, last_error")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false }),
          supabase
            .from("flows")
            .select("*")
            .eq("workspace_id", workspaceId)
            .neq("status", "archived")
            .order("updated_at", { ascending: false }),
          // El constructor de flujos si necesita la foto completa del workspace.
          supabase
            .from("flow_runs")
            .select(
              "id, flow_id, contact_id, conversation_id, current_step_id, status, updated_at",
            )
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(500),
        ])
      : [0, emptyResult, emptyResult, emptyResult, emptyResult];
  // Si la sincronizacion cambio algun prompt, se relee para no enseñar el viejo.
  const agents =
    (syncedAgents > 0 ? (await loadAgents()).data : agentsResult.data) ?? [];

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="flows">
      <FlowBuilder
        agents={agents}
        flows={(flowsResult.data ?? []) as never}
        integrations={(integrationsResult.data ?? []) as never}
        runs={(flowRunsResult.data ?? []) as never}
        workspaceCode={workspaceCode}
        workspaceId={workspaceId ?? null}
      />
    </PanelPage>
  );
}
