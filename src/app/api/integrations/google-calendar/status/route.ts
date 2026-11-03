import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { getConnectionStatus } from "@/lib/integrations/google-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/** Estado de Google Calendar en la empresa activa (para la tarjeta de Integraciones). */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);

    return NextResponse.json(await getConnectionStatus(createAdminClient(), workspaceId));
  } catch (error) {
    return apiErrorResponse(error, "integrations/google-calendar/status");
  }
}
