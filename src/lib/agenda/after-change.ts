import "server-only";

import { after } from "next/server";

import type { CrmClient } from "../crm/shared.ts";
import { syncAppointment } from "./google-sync.ts";

/**
 * Tras crear, mover o cancelar citas desde el panel: copia a Google en
 * segundo plano (después de responder). Si falla, la barrida de crm-jobs lo
 * reintenta: la marca `google_sync_pending` se queda.
 */
export function syncAfterResponse(client: CrmClient, workspaceId: string, appointmentIds: string[]) {
  for (const appointmentId of appointmentIds) {
    after(() =>
      syncAppointment(client, workspaceId, appointmentId).then(
        () => undefined,
        (error) => console.warn("[agenda:google-sync]", appointmentId, error instanceof Error ? error.message : error),
      ),
    );
  }
}
