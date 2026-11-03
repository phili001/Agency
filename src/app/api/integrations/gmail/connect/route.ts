import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { gmailConnectUrl } from "@/lib/integrations/gmail";

/**
 * Empieza la conexión del correo de la empresa activa (owner/admin). Vuelve por
 * el callback de Google Calendar; el `state` firmado dice que es para Gmail.
 */
export async function GET() {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);

    return NextResponse.redirect(gmailConnectUrl({ userId: user.id, workspaceId }));
  } catch (error) {
    return apiErrorResponse(error, "integrations/gmail/connect");
  }
}
