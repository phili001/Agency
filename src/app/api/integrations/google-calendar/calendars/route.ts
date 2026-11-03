import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { listCalendars, writableCalendars } from "@/lib/integrations/google-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/** Calendarios de Google donde se pueden copiar las citas (para elegir el de cada agenda). */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const calendars = writableCalendars(await listCalendars(createAdminClient(), workspaceId));

    return NextResponse.json({
      calendars: calendars.map(({ id, primary, summary, timeZone }) => ({ id, primary, summary, timeZone })),
    });
  } catch (error) {
    return apiErrorResponse(error, "integrations/google-calendar/calendars");
  }
}
