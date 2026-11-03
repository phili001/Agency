import { NextResponse } from "next/server";

import { syncAfterResponse } from "@/lib/agenda/after-change";
import {
  cancelAppointment,
  confirmAppointment,
  markAppointment,
  rescheduleAppointment,
} from "@/lib/agenda/appointments";
import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `{ action }`: `reschedule` (con `startsAt`), `cancel` (con `reason`),
 * `confirm`, `completed` o `no_show`.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { appointmentId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const actor = { kind: "operator" as const, userId: user.id };
    const admin = createAdminClient();

    switch (body.action) {
      case "reschedule": {
        const appointment = await rescheduleAppointment(admin, workspaceId, { appointmentId, startsAt: String(body.startsAt ?? "") }, actor);
        syncAfterResponse(admin, workspaceId, [appointmentId, appointment.id]);
        return NextResponse.json({ appointment });
      }
      case "cancel": {
        const appointment = await cancelAppointment(admin, workspaceId, appointmentId, actor, {
          reason: typeof body.reason === "string" ? body.reason : null,
        });
        syncAfterResponse(admin, workspaceId, [appointment.id]);
        return NextResponse.json({ appointment });
      }
      case "confirm":
        return NextResponse.json({ appointment: await confirmAppointment(admin, workspaceId, appointmentId) });
      case "completed":
      case "no_show":
        return NextResponse.json({ appointment: await markAppointment(admin, workspaceId, appointmentId, body.action) });
      default:
        throw badRequest("Acción no válida.");
    }
  } catch (error) {
    return apiErrorResponse(error, "agenda/appointment:patch");
  }
}
