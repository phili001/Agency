import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { createAdminClient } from "@/lib/supabase/admin";

/** Estado del correo de Google en la empresa activa (para la tarjeta de Integraciones). */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);

    return NextResponse.json(await getGmailStatus(createAdminClient(), workspaceId));
  } catch (error) {
    return apiErrorResponse(error, "integrations/gmail/status");
  }
}
