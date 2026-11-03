import { NextResponse } from "next/server";

import { getAgendaFreeSlots } from "@/lib/agenda/appointments";
import { googleBusyProvider } from "@/lib/agenda/google-sync";
import { formatSlotLabel } from "@/lib/agenda/slots";
import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

/** Huecos libres de un día (`agendaId`, `date` YYYY-MM-DD, `service`, `exclude` para mover). */
export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const params = new URL(request.url).searchParams;
    const agendaId = params.get("agendaId");
    const date = params.get("date");

    if (!agendaId || !date) {
      throw badRequest("Faltan la agenda y el día.");
    }

    const admin = createAdminClient();
    const { agenda, service, slots } = await getAgendaFreeSlots(admin, workspaceId, agendaId, {
      excludeAppointmentId: params.get("exclude"),
      externalBusy: googleBusyProvider(admin, workspaceId),
      fromDateKey: date,
      service: params.get("service"),
      toDateKey: date,
    });

    return NextResponse.json({
      service,
      slots: slots.map((slot) => ({
        label: formatSlotLabel(slot.start, agenda.config.timezone).split(", ").at(-1),
        startsAt: slot.start.toISOString(),
      })),
      timezone: agenda.config.timezone,
    });
  } catch (error) {
    return apiErrorResponse(error, "agenda/slots:get");
  }
}
