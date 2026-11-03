import type { CrmClient } from "../crm/shared.ts";
import { isWorkspaceBlocked, listBlockedWorkspaceIds } from "./workspace-billing.ts";

/**
 * Corte por impago en los caminos que hablan con el cliente final
 * (`ycloud-webhook`, `cron/buffer`, `cron/flows`, `cron/deliver`). Lo entrante
 * se sigue guardando; solo no se generan respuestas ni se envía.
 *
 * Aquí, si la consulta de facturación falla, **no se bloquea** (mejor seguir
 * atendiendo que cortar a todos por un error). `crm-jobs` hace lo contrario:
 * si su paso `billing` falla, no manda avisos.
 */

const ID_PATTERN = /^[0-9a-f-]{1,64}$/i;

export async function blockedWorkspaceIdsOrNone(client: CrmClient, options: { now?: Date } = {}) {
  try {
    return await listBlockedWorkspaceIds(client, options);
  } catch (error) {
    console.error("[billing] No se pudo leer qué empresas están bloqueadas:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function isWorkspaceBlockedOrNot(client: CrmClient, workspaceId: string) {
  try {
    return await isWorkspaceBlocked(client, workspaceId);
  } catch (error) {
    console.error("[billing] No se pudo leer la facturación de la empresa:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Valor para `.not("workspace_id", "in", …)` de PostgREST, o null si no hay ninguna. */
export function notInWorkspaces(ids: string[]) {
  const safe = ids.filter((id) => ID_PATTERN.test(id));
  return safe.length ? `(${safe.join(",")})` : null;
}
