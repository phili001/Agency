import { NextResponse } from "next/server";

import { getAgenda, setDefaultAgenda, updateAgenda, withoutConfig } from "@/lib/agenda/agendas";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Configuración de una agenda (owner/admin). `{ makeDefault: true }` la marca
 * como la de por defecto; el resto de campos, ver `agendaChanges`.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ agendaId: string }> }) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { agendaId } = await params;
    const { makeDefault, ...body } = (await request.json()) as Record<string, unknown>;
    const admin = createAdminClient();

    if (makeDefault === true) {
      await setDefaultAgenda(admin, workspaceId, agendaId);
    }

    const hasChanges = Object.keys(body).length > 0;
    const agenda = hasChanges
      ? await updateAgenda(admin, workspaceId, agendaId, body)
      : await getAgenda(admin, workspaceId, agendaId);

    return NextResponse.json({ agenda: withoutConfig(agenda) });
  } catch (error) {
    return apiErrorResponse(error, "agenda/agenda:patch");
  }
}
