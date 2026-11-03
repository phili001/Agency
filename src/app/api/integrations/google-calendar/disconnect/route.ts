import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { disconnect } from "@/lib/integrations/google-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Desconecta Google de la empresa activa. Las agendas conservan su calendario y
 * modo elegidos; sin conexión, la copia a Google simplemente no se hace.
 */
export async function POST() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    await disconnect(createAdminClient(), workspaceId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "integrations/google-calendar/disconnect");
  }
}
