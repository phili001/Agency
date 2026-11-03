import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { buildAuthUrl, createOAuthState } from "@/lib/integrations/google-calendar";

/**
 * Empieza la conexión con Google de la empresa activa (owner/admin): redirige a
 * la pantalla de consentimiento con un `state` firmado (empresa + usuario).
 */
export async function GET() {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const state = createOAuthState({ userId: user.id, workspaceId });

    return NextResponse.redirect(buildAuthUrl(state));
  } catch (error) {
    return apiErrorResponse(error, "integrations/google-calendar/connect");
  }
}
