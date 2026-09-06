import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import {
  getWorkspaceCalendarContext,
  listCalendars,
} from "@/lib/integrations/ghl-calendar";

export async function GET(request: Request) {
  try {
    const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent"]);
    const context = await getWorkspaceCalendarContext(workspaceId);

    if (!context) {
      return NextResponse.json(
        { error: "Conecta GoHighLevel primero." },
        { status: 400 },
      );
    }

    const calendars = await listCalendars({
      apiKey: context.apiKey,
      locationId: context.locationId,
    });

    return NextResponse.json({ calendars, selected: context.calendarId });
  } catch (error) {
    return apiErrorResponse(error, "integrations/gohighlevel/calendars");
  }
}
