import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { isValidTimeZone } from "@/lib/timezones";
import {
  bookLevyMeeting,
  cancelLevyMeeting,
  getLevyCalendar,
  getLevyMeetingDays,
} from "@/lib/integrations/levy-calendar";
import { syncAfterResponse } from "@/lib/agenda/after-change";
import { googleBusyProvider } from "@/lib/agenda/google-sync";
import { bookMeeting, cancelMeeting, getMeetingDays, resolveMeetingAgenda, type MeetingTarget } from "@/lib/agenda/levy-meeting";
import { getBookedMeeting, type BookedMeeting } from "@/lib/onboarding-meeting";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Motor de la reunión: la agenda de AAA001 si `LEVY_MEETING_AGENDA_ID` apunta
 * a una agenda activa suya; si no, el calendario de GoHighLevel (hasta F7.2).
 */
async function meetingEngine() {
  const admin = createAdminClient();
  const target = await resolveMeetingAgenda(admin);
  return { admin, target };
}

async function cancelExisting(meeting: BookedMeeting, target: MeetingTarget | null) {
  if (meeting.engine === "agenda") {
    if (target) {
      const admin = createAdminClient();
      if (await cancelMeeting(admin, target, meeting.appointmentId)) {
        syncAfterResponse(admin, target.workspaceId, [meeting.appointmentId]);
      }
    }
    return;
  }
  await cancelLevyMeeting(meeting.appointmentId);
}

/** Guarda (o borra) la reunión dentro de workspaces.onboarding_state. */
async function saveMeeting(
  workspaceId: string,
  meeting: Record<string, string> | null,
) {
  const admin = createAdminClient();
  const { data: workspace, error: readError } = await admin
    .from("workspaces")
    .select("onboarding_state")
    .eq("id", workspaceId)
    .single();

  if (readError) {
    throw readError;
  }

  const current =
    workspace.onboarding_state &&
    typeof workspace.onboarding_state === "object" &&
    !Array.isArray(workspace.onboarding_state)
      ? { ...(workspace.onboarding_state as Record<string, unknown>) }
      : {};

  if (meeting) {
    current.meeting = meeting;
  } else {
    delete current.meeting;
  }

  const { error } = await admin
    .from("workspaces")
    .update({ onboarding_state: current })
    .eq("id", workspaceId);

  if (error) {
    throw error;
  }
}

async function readWorkspaceCode(workspaceId: string) {
  const { data } = await createAdminClient()
    .from("workspaces")
    .select("company_code")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.company_code ?? null;
}

async function readWorkspace(workspaceId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("name, onboarding_state")
    .eq("id", workspaceId)
    .single();

  return data;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    const timeZone = searchParams.get("timezone")?.trim() ?? "";

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
    const { admin, target } = await meetingEngine();

    if (target) {
      const workspace = await readWorkspace(workspaceId);
      const meeting = getBookedMeeting(workspace?.onboarding_state);
      try {
        return NextResponse.json({
          available: true,
          days: await getMeetingDays(admin, target, timeZone, { externalBusy: googleBusyProvider(admin, target.workspaceId) }),
          meeting,
        });
      } catch (error) {
        console.error("[onboarding/meeting] Agenda de AAA001 sin huecos:", error instanceof Error ? error.message : error);
        return NextResponse.json({ available: true, days: [], error: "calendar", meeting });
      }
    }

    const [calendar, workspace] = await Promise.all([
      getLevyCalendar(),
      readWorkspace(workspaceId),
    ]);

    if (!calendar) {
      return NextResponse.json({ available: false, days: [], meeting: null });
    }

    const meeting = getBookedMeeting(workspace?.onboarding_state);

    try {
      return NextResponse.json({
        available: true,
        days: await getLevyMeetingDays(timeZone),
        meeting,
      });
    } catch {
      // GoHighLevel caído o mal configurado: el paso sigue abierto, pero sin
      // horas. La pantalla enseña el contacto de soporte. El motivo real ya
      // quedó en el log del servidor, con el nombre de la variable a revisar.
      return NextResponse.json({ available: true, days: [], error: "calendar", meeting });
    }
  } catch (error) {
    return apiErrorResponse(error, "onboarding/meeting");
  }
}

export async function POST(request: Request) {
  try {
    const { action, phone, startTime, timezone, workspaceId } = (await request.json()) as {
      action?: "book" | "cancel";
      phone?: string;
      startTime?: string;
      timezone?: string;
      workspaceId?: string;
    };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    const { user } = await requireWorkspaceRole(workspaceId, ["owner", "admin"]);
    const workspace = await readWorkspace(workspaceId);
    const current = getBookedMeeting(workspace?.onboarding_state);
    const { admin, target } = await meetingEngine();

    if (action === "cancel") {
      if (current) {
        await cancelExisting(current, target);
        await saveMeeting(workspaceId, null);
      }

      return NextResponse.json({ meeting: null, ok: true });
    }

    const cleanPhone = phone?.trim() ?? "";
    const zone = timezone?.trim() ?? "";

    if (!startTime || Number.isNaN(new Date(startTime).getTime())) {
      throw badRequest("Elige una hora de la lista.");
    }

    if (new Date(startTime).getTime() < Date.now()) {
      throw badRequest("Esa hora ya pasó. Elige otra de la lista.");
    }

    if (!/^\+?[0-9\s-]{7,20}$/.test(cleanPhone)) {
      throw badRequest("Escribe un teléfono de contacto para la reunión.");
    }

    const fullName =
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
    const timezoneToSave = isValidTimeZone(zone) ? zone : "Europe/Madrid";

    if (target) {
      if (!cleanPhone.startsWith("+")) {
        throw badRequest("Escribe el teléfono con el prefijo de país, por ejemplo +34 600 000 000.");
      }
      // Primero la nueva (comprueba que el hueco sigue libre) y luego se libera la anterior.
      const { appointmentId } = await bookMeeting(admin, target, {
        companyName: workspace?.name ?? "Cliente Levy",
        email: user.email,
        externalBusy: googleBusyProvider(admin, target.workspaceId),
        fullName,
        phone: cleanPhone.replace(/[\s-]/g, ""),
        startTime,
        workspaceCode: await readWorkspaceCode(workspaceId),
      });
      if (current) {
        await cancelExisting(current, target);
      }
      syncAfterResponse(admin, target.workspaceId, [appointmentId]);
      const meeting = {
        appointmentId,
        bookedAt: new Date().toISOString(),
        engine: "agenda",
        phone: cleanPhone,
        startTime,
        timezone: timezoneToSave,
      };
      await saveMeeting(workspaceId, meeting);
      return NextResponse.json({ meeting, ok: true });
    }

    // Solo horas que el calendario ofrece ahora mismo: evita colar una hora
    // suelta y acabar con una cita fuera del horario del equipo.
    const days = await getLevyMeetingDays(zone);
    const offered = days.some((day) =>
      day.slots.some((slot) => new Date(slot.iso).getTime() === new Date(startTime).getTime()),
    );

    if (!offered) {
      throw badRequest("Esa hora acaba de ocuparse. Elige otra de la lista.");
    }

    // Si ya tenía una, se cambia: primero se libera la anterior.
    if (current) {
      await cancelExisting(current, target);
    }

    const appointmentId = await bookLevyMeeting({
      companyName: workspace?.name ?? "Cliente Levy",
      email: user.email,
      fullName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
      phone: cleanPhone,
      startTime,
    });
    const meeting = {
      appointmentId,
      bookedAt: new Date().toISOString(),
      engine: "ghl",
      phone: cleanPhone,
      startTime,
      timezone: timezoneToSave,
    };

    await saveMeeting(workspaceId, meeting);

    return NextResponse.json({ meeting, ok: true });
  } catch (error) {
    return apiErrorResponse(error, "onboarding/meeting");
  }
}
