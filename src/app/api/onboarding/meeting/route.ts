import { after, NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { isValidTimeZone } from "@/lib/timezones";
import { syncAfterResponse } from "@/lib/agenda/after-change";
import { googleBusyProvider } from "@/lib/agenda/google-sync";
import { bookMeeting, cancelMeeting, getMeetingDays, resolveMeetingAgenda, type MeetingTarget } from "@/lib/agenda/levy-meeting";
import { sendMeetingEmail, type MeetingEmailInput } from "@/lib/agenda/levy-meeting-email";
import { getBookedMeeting, type BookedMeeting } from "@/lib/onboarding-meeting";
import { createAdminClient } from "@/lib/supabase/admin";

/** La reunión vive en la agenda de AAA001 (`LEVY_MEETING_AGENDA_ID`). */
async function meetingEngine() {
  const admin = createAdminClient();
  const target = await resolveMeetingAgenda(admin);
  return { admin, target };
}

/** Devuelve si de verdad se canceló: si ya no estaba activa, no hay nada que avisar. */
async function cancelExisting(meeting: BookedMeeting, target: MeetingTarget | null) {
  if (!target) {
    return false;
  }

  const admin = createAdminClient();
  const cancelled = await cancelMeeting(admin, target, meeting.appointmentId);

  if (cancelled) {
    syncAfterResponse(admin, target.workspaceId, [meeting.appointmentId]);
  }

  return cancelled;
}

/** El correo va después de responder: ni lo espera el cliente ni puede tumbar la reserva. */
function emailAfterResponse(input: MeetingEmailInput) {
  after(async () => {
    await sendMeetingEmail(input);
  });
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

    if (!target) {
      return NextResponse.json({ available: false, days: [], meeting: null });
    }

    const workspace = await readWorkspace(workspaceId);
    const meeting = getBookedMeeting(workspace?.onboarding_state);

    try {
      return NextResponse.json({
        available: true,
        days: await getMeetingDays(admin, target, timeZone, { externalBusy: googleBusyProvider(admin, target.workspaceId) }),
        meeting,
      });
    } catch (error) {
      // Agenda caída: el paso sigue abierto, pero sin horas. La pantalla enseña
      // el contacto de soporte.
      console.error("[onboarding/meeting] Agenda de AAA001 sin huecos:", error instanceof Error ? error.message : error);
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
        const cancelled = await cancelExisting(current, target);
        await saveMeeting(workspaceId, null);

        if (cancelled && target) {
          emailAfterResponse({
            companyName: workspace?.name ?? "",
            kind: "cancelled",
            startTime: current.startTime,
            timezone: current.timezone,
            to: current.email || user.email,
          });
        }
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

    if (!target) {
      throw badRequest("La reunión no se puede reservar ahora mismo. Escríbenos y la agendamos contigo.");
    }

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
    const moved = current ? await cancelExisting(current, target) : false;
    syncAfterResponse(admin, target.workspaceId, [appointmentId]);
    const meeting = {
      appointmentId,
      bookedAt: new Date().toISOString(),
      email: user.email ?? "",
      phone: cleanPhone,
      startTime,
      timezone: timezoneToSave,
    };

    await saveMeeting(workspaceId, meeting);
    emailAfterResponse({
      companyName: workspace?.name ?? "",
      kind: moved ? "moved" : "confirmed",
      previousStartTime: moved ? current?.startTime : null,
      startTime,
      timezone: timezoneToSave,
      to: user.email,
    });

    return NextResponse.json({ meeting, ok: true });
  } catch (error) {
    return apiErrorResponse(error, "onboarding/meeting");
  }
}
