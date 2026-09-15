import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { parseCalendarTools } from "@/lib/calendar-tools";
import {
  createAppointment,
  deleteCalendarEvent,
  ensureGhlContact,
  getAppointment,
  getLocationTimezone,
  getVerifiedFreeSlots,
  isValidTimeZone,
  listCalendars,
} from "@/lib/integrations/ghl-calendar";
import {
  deleteGoHighLevelContact,
  getWorkspaceGoHighLevelKey,
} from "@/lib/integrations/gohighlevel";
import { createAdminClient } from "@/lib/supabase/admin";

type TestStep = {
  detail?: string;
  key: string;
  label: string;
  status: "failed" | "passed";
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readAppointmentStart(value: unknown) {
  const payload = asRecord(value);
  const event = asRecord(payload.event);
  const appointment = asRecord(payload.appointment);

  return (
    readString(event.startTime) ??
    readString(event.start_time) ??
    readString(appointment.startTime) ??
    readString(appointment.start_time) ??
    readString(payload.startTime) ??
    readString(payload.start_time)
  );
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido.";
}

async function runStep<T>(
  steps: TestStep[],
  key: string,
  label: string,
  action: () => Promise<T>,
  detail?: (result: T) => string,
) {
  try {
    const result = await action();
    steps.push({
      detail: detail?.(result),
      key,
      label,
      status: "passed",
    });
    return result;
  } catch (error) {
    steps.push({ key, label, status: "failed", detail: errorText(error) });
    throw error;
  }
}

export async function POST(request: Request) {
  const steps: TestStep[] = [];
  let apiKey: string | null = null;
  let contactId: string | null = null;
  const eventIds = new Set<string>();

  try {
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, ["owner", "admin", "agent"]);
    apiKey = await getWorkspaceGoHighLevelKey(workspaceId);

    if (!apiKey) {
      return NextResponse.json({ error: "Conecta GoHighLevel primero." }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: integration }, { data: toolAssets }] = await Promise.all([
        admin
          .from("integrations")
          .select("config")
          .eq("workspace_id", workspaceId)
          .eq("provider", "gohighlevel")
          .eq("status", "active")
          .maybeSingle(),
        admin
          .from("workspace_assets")
          .select("id, title, content, metadata")
          .eq("workspace_id", workspaceId)
          .eq("kind", "tool")
          .neq("status", "archived"),
      ]);
    const config = asRecord(integration?.config);
    const locationId = readString(config.location_id);

    if (!locationId) {
      return NextResponse.json(
        { error: "Falta el Location ID de GoHighLevel." },
        { status: 400 },
      );
    }

    const calendars = await runStep(
      steps,
      "connection",
      "Conexión y permisos",
      () => listCalendars({ apiKey: apiKey!, locationId }),
      (items) => `${items.length} calendario(s) accesible(s).`,
    );
    const tools = parseCalendarTools(toolAssets ?? []);
    const configuredIds = [
      ...new Set([
        ...tools.map((tool) => tool.calendarId),
        ...(readString(config.calendar_id) ? [readString(config.calendar_id)!] : []),
      ]),
    ];

    if (configuredIds.length === 0) {
      throw new Error("No hay un calendario configurado en Tools para probar.");
    }

    const configuredCalendars = configuredIds.map((calendarId) => {
      const calendar = calendars.find((item) => item.id === calendarId);

      if (!calendar) {
        throw new Error(`GHL no devolvió el calendario configurado ${calendarId}.`);
      }

      return calendar;
    });
    steps.push({
      detail: `${configuredCalendars.length} calendario(s) configurado(s).`,
      key: "calendar_config",
      label: "Calendarios configurados",
      status: "passed",
    });

    const locationTimezone = await runStep(
      steps,
      "location_timezone",
      "Zona horaria de la subcuenta GHL",
      async () => {
        const timezone = await getLocationTimezone({ apiKey: apiKey!, locationId });

        if (!timezone) {
          throw new Error(
            "No se pudo leer la zona horaria de GHL. Agrega el permiso View Locations al Private Integration Token.",
          );
        }

        return timezone;
      },
      (timezone) => timezone,
    );
    const testNumber = String(Math.floor(Math.random() * 100)).padStart(2, "0");
    contactId = await runStep(
      steps,
      "test_contact",
      "Contacto temporal",
      () =>
        ensureGhlContact({
          apiKey: apiKey!,
          email: `calendar-test-${Date.now()}@example.com`,
          fullName: "Prueba técnica Levy",
          locationId,
          phone: `+120255501${testNumber}`,
        }).then((id) => {
          if (!id) {
            throw new Error("GHL no devolvió el ID del contacto temporal.");
          }

          return id;
        }),
    );

    for (const calendar of configuredCalendars) {
      const timezone = calendar.timezone ?? locationTimezone;

      if (!timezone || !isValidTimeZone(timezone)) {
        throw new Error(
          `No hay zona horaria valida para el calendario ${calendar.name}.`,
        );
      }

      steps.push({
        detail: timezone,
        key: `timezone:${calendar.id}`,
        label: `Zona horaria: ${calendar.name}`,
        status: "passed",
      });
      const startDate = new Date(Date.now() + 5 * 60 * 1000);
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const slots = await runStep(
        steps,
        `availability:${calendar.id}`,
        `Disponibilidad: ${calendar.name}`,
        () =>
          getVerifiedFreeSlots({
            apiKey: apiKey!,
            calendarId: calendar.id,
            endDate,
            locationId,
            startDate,
            timezone,
          }).then((result) => {
            if (result.slots.length === 0) {
              throw new Error("GHL no devolvió horarios libres en los próximos 30 días.");
            }

            return result.slots;
          }),
        (items) => `${items.length} horario(s) encontrado(s).`,
      );
      const slot = slots[0];
      const eventId = await runStep(
        steps,
        `create:${calendar.id}`,
        `Crear cita: ${calendar.name}`,
        () =>
          createAppointment({
            apiKey: apiKey!,
            calendarId: calendar.id,
            contactId: contactId!,
            locationId,
            startTime: slot.iso,
            title: "[PRUEBA AUTOMÁTICA] Levy",
          }),
        () => slot.label,
      );
      eventIds.add(eventId);
      await runStep(
        steps,
        `read:${calendar.id}`,
        `Verificar fecha y hora exactas: ${calendar.name}`,
        async () => {
          const appointment = await getAppointment({ apiKey: apiKey!, eventId });
          const actualStart = readAppointmentStart(appointment);

          if (!actualStart) {
            throw new Error(
              "GHL devolvió la cita, pero no incluyo la fecha/hora para verificarla.",
            );
          }

          if (new Date(actualStart).getTime() !== new Date(slot.iso).getTime()) {
            throw new Error(
              "GHL creo la cita en una hora distinta al horario solicitado.",
            );
          }

          return actualStart;
        },
        () => `Hora verificada: ${slot.label}.`,
      );
      await runStep(
        steps,
        `delete:${calendar.id}`,
        `Eliminar cita de prueba: ${calendar.name}`,
        () => deleteCalendarEvent({ apiKey: apiKey!, eventId }),
      );
      eventIds.delete(eventId);
    }

    await runStep(steps, "delete_contact", "Eliminar contacto temporal", () =>
      deleteGoHighLevelContact({ apiKey: apiKey!, contactId: contactId! }),
    );
    contactId = null;

    return NextResponse.json({
      message: "Prueba completa superada: GHL creo, verifico y elimino la cita correctamente.",
      ok: true,
      steps,
    });
  } catch (error) {
    const cleanupErrors: string[] = [];

    if (apiKey) {
      for (const eventId of eventIds) {
        try {
          await deleteCalendarEvent({ apiKey, eventId });
        } catch (cleanupError) {
          cleanupErrors.push(`Cita ${eventId}: ${errorText(cleanupError)}`);
        }
      }

      if (contactId) {
        try {
          await deleteGoHighLevelContact({ apiKey, contactId });
        } catch (cleanupError) {
          cleanupErrors.push(`Contacto temporal: ${errorText(cleanupError)}`);
        }
      }
    }

    return NextResponse.json(
      {
        cleanupErrors,
        error: errorText(error),
        ok: false,
        steps,
      },
      { status: 502 },
    );
  }
}
