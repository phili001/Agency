import { NextResponse } from "next/server";

import { syncAfterResponse } from "@/lib/agenda/after-change";
import { bookAppointment, listAppointments, listBlocks } from "@/lib/agenda/appointments";
import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

function dateParam(value: string | null, label: string) {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`Falta o no es válida la fecha «${label}».`);
  }
  return date;
}

/** Citas y bloqueos de un rango (`from`, `to`, `agendaId` opcional), con el nombre del contacto. */
export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent", "viewer"]);
    const params = new URL(request.url).searchParams;
    const from = dateParam(params.get("from"), "desde");
    const to = dateParam(params.get("to"), "hasta");
    const agendaId = params.get("agendaId") || undefined;
    const admin = createAdminClient();
    const [appointments, blocks] = await Promise.all([
      listAppointments(admin, workspaceId, { agendaId, from, includeCancelled: params.get("cancelled") === "1", to }),
      listBlocks(admin, workspaceId, { agendaId, from, to }),
    ]);
    const contactIds = Array.from(new Set(appointments.map((item) => item.contact_id)));
    const { data: contacts } = contactIds.length
      ? await admin
          .from("contacts")
          .select("id, full_name, phone_e164")
          .eq("workspace_id", workspaceId)
          .in("id", contactIds)
      : { data: [] };
    const byId = new Map(((contacts ?? []) as Array<{ full_name: string | null; id: string; phone_e164: string }>).map((row) => [row.id, row]));

    return NextResponse.json({
      appointments: appointments.map((item) => ({
        ...item,
        contact_name: byId.get(item.contact_id)?.full_name ?? null,
        contact_phone: byId.get(item.contact_id)?.phone_e164 ?? null,
      })),
      blocks,
    });
  } catch (error) {
    return apiErrorResponse(error, "agenda/appointments:get");
  }
}

/** Cita creada por el equipo: puede ir fuera de horario; nunca encima de otra. */
export async function POST(request: Request) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.agendaId !== "string" || typeof body.contactId !== "string") {
      throw badRequest("Elige la agenda y el contacto.");
    }

    const admin = createAdminClient();
    const appointment = await bookAppointment(
      admin,
      workspaceId,
      {
        agendaId: body.agendaId,
        contactId: body.contactId,
        notes: typeof body.notes === "string" ? body.notes : null,
        service: typeof body.service === "string" ? body.service : null,
        startsAt: String(body.startsAt ?? ""),
      },
      { kind: "operator", userId: user.id },
    );
    syncAfterResponse(admin, workspaceId, [appointment.id]);

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "agenda/appointments:post");
  }
}
