import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { disconnectGmail } from "@/lib/integrations/gmail";
import { createAdminClient } from "@/lib/supabase/admin";

/** Desconecta el correo de la empresa activa. Google Calendar sigue conectado. */
export async function POST() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    await disconnectGmail(createAdminClient(), workspaceId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "integrations/gmail/disconnect");
  }
}
