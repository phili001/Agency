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
  const [syncedAgents, agentsResult, flowsResult, flowRunsResult] =
    workspaceId
      ? await Promise.all([
          syncDefaultAgentPrompts(supabase, workspaceId),
          loadAgents(),
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
      : [0, emptyResult, emptyResult, emptyResult];
  // Opciones del CRM para los desplegables de acciones y del disparador por etiqueta.
  const [tagsResult, stagesResult, fieldsResult, agendasResult] = workspaceId
    ? await Promise.all([
        supabase.from("crm_tags").select("id, name").eq("workspace_id", workspaceId).order("name"),
        supabase
          .from("crm_pipeline_stages")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .order("position"),
        supabase
          .from("crm_custom_fields")
          .select("key, label")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .order("position"),
        supabase
          .from("agendas")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .order("name"),
      ])
    : [emptyResult, emptyResult, emptyResult, emptyResult];
  const crm = {
    agendas: (agendasResult.data ?? []) as Array<{ id: string; name: string }>,
    customFields: (fieldsResult.data ?? []) as Array<{ key: string; label: string }>,
    stages: (stagesResult.data ?? []) as Array<{ id: string; name: string }>,
    tags: (tagsResult.data ?? []) as Array<{ id: string; name: string }>,
  };
  // Si la sincronizacion cambio algun prompt, se relee para no enseñar el viejo.
  const agents =
    (syncedAgents > 0 ? (await loadAgents()).data : agentsResult.data) ?? [];

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="flows">
      <FlowBuilder
        agents={agents}
        crm={crm}
        flows={(flowsResult.data ?? []) as never}
        runs={(flowRunsResult.data ?? []) as never}
        workspaceCode={workspaceCode}
        workspaceId={workspaceId ?? null}
      />
    </PanelPage>
  );
}
