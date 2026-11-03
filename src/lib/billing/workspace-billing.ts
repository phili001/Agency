import type { CrmClient } from "../crm/shared.ts";
import { getBillingConfig } from "./config.ts";
import {
  BLOCKABLE_STATUSES,
  computeBillingState,
  type WorkspaceBillingRow,
  type WorkspaceBillingState,
} from "./state.ts";

const BILLING_COLUMNS = "workspace_id, billing_exempt, cancel_at_period_end, current_period_end, past_due_since, status";

type Options = { env?: Record<string, string | undefined>; now?: Date };

export async function getWorkspaceBillingRow(client: CrmClient, workspaceId: string) {
  const { data, error } = await client
    .from("workspace_billing")
    .select(BILLING_COLUMNS)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`workspace_billing: ${error.message}`);
  }
  return (data as WorkspaceBillingRow | null) ?? null;
}

/** Estado de facturación de la empresa (`ok|aviso|bloqueado`). */
export async function getWorkspaceBillingState(
  client: CrmClient,
  workspaceId: string,
  { env, now = new Date() }: Options = {},
): Promise<WorkspaceBillingState> {
  const row = await getWorkspaceBillingRow(client, workspaceId);
  return computeBillingState(row, { graceDays: getBillingConfig(env).graceDays, now });
}

/** ¿Hay que callar a la IA y no enviar nada en esta empresa? */
export async function isWorkspaceBlocked(client: CrmClient, workspaceId: string, options: Options = {}) {
  return (await getWorkspaceBillingState(client, workspaceId, options)).state === "bloqueado";
}

/**
 * Empresas bloqueadas ahora mismo. Es el paso `billing` de `runCrmJobs`
 * (F6.4 lo conecta en la ruta).
 */
export async function listBlockedWorkspaceIds(client: CrmClient, { env, now = new Date() }: Options = {}) {
  const { data, error } = await client
    .from("workspace_billing")
    .select(BILLING_COLUMNS)
    .eq("billing_exempt", false)
    .in("status", BLOCKABLE_STATUSES);

  if (error) {
    throw new Error(`workspace_billing: ${error.message}`);
  }

  const graceDays = getBillingConfig(env).graceDays;
  return ((data ?? []) as WorkspaceBillingRow[])
    .filter((row) => computeBillingState(row, { graceDays, now }).state === "bloqueado")
    .map((row) => row.workspace_id);
}
