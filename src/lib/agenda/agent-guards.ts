import type { CalendarTool } from "@/lib/calendar-tools";

import { zonedStartOfDay } from "../timezones.ts";

/**
 * Lo que el agente de WhatsApp sabe y dice de la agenda, sin tocar red ni base:
 * definiciones de las tools de calendario, el bloque de instrucciones, las
 * respuestas directas a partir del resultado de una tool y la barrera que
 * bloquea respuestas que afirman una cita o una disponibilidad sin prueba.
 *
 * Movido tal cual desde `app/api/cron/buffer/route.ts` (F5.0) para poder
 * probarlo; el comportamiento es el mismo.
 */

/** Lo mínimo del runtime que necesitan los textos (ver `agent-tools.ts`). */
export type CalendarRuntimeView = {
  calendars: Array<Pick<CalendarTool, "calendarName" | "description">>;
  contact: { fullName: string | null };
  /** "agenda" añade las instrucciones de reagendar y cancelar. */
  engine?: "agenda";
  timezone: string;
  /** Citas próximas del contacto (solo agenda propia). */
  upcoming?: Array<{ label: string; service: string; startsAt: string }>;
};

function normalizeClaimText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, " ");
}

export function buildCalendarToolDefinitions(
  calendars: Array<Pick<CalendarTool, "calendarName" | "description">>,
  { withChanges = false }: { withChanges?: boolean } = {},
) {
  const multiple = calendars.length > 1;
  const options = calendars
    .map(
      (calendar) =>
        `- "${calendar.calendarName}": ${calendar.description || "sin descripción"}`,
    )
    .join("\n");
  const calendarProperty = multiple
    ? {
        calendario: {
          description: `Cual agenda usar, segun lo que pida el cliente:\n${options}`,
          enum: calendars.map((calendar) => calendar.calendarName),
          type: "string",
        },
      }
    : {};
  const calendarRequired = multiple ? ["calendario"] : [];

  type ToolDefinition = {
    description: string;
    name: string;
    parameters: { additionalProperties: false; properties: Record<string, unknown>; required: string[]; type: "object" };
    strict: true;
    type: "function";
  };
  const tools: ToolDefinition[] = [
    {
      description:
        "Consulta los horarios realmente disponibles. Usala SIEMPRE antes de proponer u ofrecer cualquier horario al cliente.",
      name: "consultar_disponibilidad",
      parameters: {
        additionalProperties: false as const,
        properties: {
          ...calendarProperty,
          dias: {
            description:
              "Cuantos días hacia adelante buscar desde la fecha de inicio. Entre 1 y 14.",
            type: "integer",
          },
          fecha_inicio: {
            description:
              "Fecha desde la que buscar, en formato YYYY-MM-DD. Usa la fecha de hoy si el cliente no indica otra.",
            type: "string",
          },
        },
        required: [...calendarRequired, "fecha_inicio", "dias"],
        type: "object" as const,
      },
      strict: true as const,
      type: "function" as const,
    },
    {
      description:
        "Crea la cita. Usala solo después de consultar disponibilidad y de que el cliente haya elegido un horario concreto de los ofrecidos.",
      name: "agendar_cita",
      parameters: {
        additionalProperties: false as const,
        properties: {
          ...calendarProperty,
          horario_iso: {
            description:
              "El horario exacto elegido, copiado tal cual del campo 'inicio' que devolvió consultar_disponibilidad.",
            type: "string",
          },
          motivo: {
            description: "Motivo o servicio de la cita, en pocas palabras.",
            type: "string",
          },
          nombre: {
            description: "Nombre completo del cliente.",
            type: "string",
          },
        },
        required: [...calendarRequired, "horario_iso", "nombre", "motivo"],
        type: "object" as const,
      },
      strict: true as const,
      type: "function" as const,
    },
  ];

  if (!withChanges) {
    return tools;
  }

  // Agenda propia: el servicio decide la duración, y se puede mover o cancelar.
  const consult = tools[0].parameters;
  consult.properties.servicio = {
    description: "Servicio que quiere el cliente (decide la duración). null si no lo ha dicho.",
    type: ["string", "null"],
  };
  consult.required.push("servicio");
  const currentAppointment = {
    description:
      "El 'inicio' exacto de la cita que se quiere cambiar, de la lista de citas próximas. null si solo tiene una.",
    type: ["string", "null"],
  };

  tools.push(
    {
      description:
        "Mueve una cita existente del cliente a otro horario. Usala solo después de consultar disponibilidad y de que el cliente elija el nuevo horario.",
      name: "reagendar_cita",
      parameters: {
        additionalProperties: false as const,
        properties: {
          cita_actual_inicio: currentAppointment,
          horario_iso: {
            description: "El nuevo horario, copiado tal cual del campo 'inicio' que devolvió consultar_disponibilidad.",
            type: "string",
          },
        },
        required: ["cita_actual_inicio", "horario_iso"],
        type: "object" as const,
      },
      strict: true as const,
      type: "function" as const,
    },
    {
      description: "Cancela una cita existente del cliente. Usala solo si el cliente pide cancelar de forma clara.",
      name: "cancelar_cita",
      parameters: {
        additionalProperties: false as const,
        properties: {
          cita_actual_inicio: currentAppointment,
          motivo: { description: "Por qué cancela, en pocas palabras. null si no lo dijo.", type: ["string", "null"] },
        },
        required: ["cita_actual_inicio", "motivo"],
        type: "object" as const,
      },
      strict: true as const,
      type: "function" as const,
    },
  );

  return tools;
}

/**
 * Barrera anti-alucinacion para agentes sin calendario. Sin esto un agente
 * afirmaba haber agendado citas que nunca existieron.
 */
export function buildNoCalendarContext() {
  return `Agenda -- NO tienes acceso:
- No puedes consultar disponibilidad ni crear citas. No tienes ninguna tool de calendario.
- PROHIBIDO decir que agendaste, reservaste, confirmaste o registraste una cita.
- PROHIBIDO afirmar que tienes un horario libre o proponer una hora concreta.
- PROHIBIDO prometer recordatorios o confirmaciones de una cita.
- Si el cliente quiere agendar, dile con naturalidad que enseguida lo ayudan con la agenda y pidele que confirme que quiere reservar. No inventes el paso siguiente.`;
}

export function buildCalendarContext(calendarRuntime: CalendarRuntimeView | null) {
  if (!calendarRuntime) {
    return buildNoCalendarContext();
  }

  // Sin la fecha de hoy el modelo no puede resolver "manana" ni "el jueves".
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendarRuntime.timezone,
  }).format(new Date());

  const calendarList =
    calendarRuntime.calendars.length > 1
      ? `\n- Tienes varias agendas. Elige la que corresponda a lo que pida el cliente:\n${calendarRuntime.calendars
          .map(
            (calendar) =>
              `  - "${calendar.calendarName}": ${
                calendar.description || "sin descripción"
              }`,
          )
          .join(
            "\n",
          )}\n- Si no queda claro cual corresponde, preguntale al cliente antes de consultar horarios.`
      : "";

  return `Agenda conectada:
- Hoy es ${today} (formato YYYY-MM-DD) en la zona horaria ${calendarRuntime.timezone}.
- Tienes acceso real al calendario mediante tools. Los horarios que devuelven son reales.${calendarList}
- Antes de mencionar cualquier horario, llama a consultar_disponibilidad. Nunca inventes huecos.
- En el resultado de consultar_disponibilidad, fecha_consultada y horario_solicitado_disponible son autoritativos.
- Si horario_solicitado_disponible es true, confirma esa hora. Si es false, indica que no está libre y ofrece solamente horarios devueltos para fecha_consultada.
- No cambies a otro dia ni ofrezcas fechas distintas de fecha_consultada salvo que el cliente lo pida expresamente.
- Ofrece como maximo 3 opciones por mensaje, en lenguaje natural, sin mostrar fechas ISO ni IDs.
- Solo llama a agendar_cita cuando el cliente haya elegido explicitamente uno de los horarios que le ofreciste, y ya tengas su nombre.
- SOLO puedes decir que la cita quedo agendada si agendar_cita respondio con
  "confirmada": true y un "cita_id". Esa respuesta es la unica prueba valida.
- Si agendar_cita devuelve un error, o no devuelve "cita_id", la cita NO existe.
  Dilo con claridad, discupate y ofrece reintentar u otro horario. Nunca digas
  que quedo agendada, ni prometas recordatorios de una cita que fallo.
- Si una tool devuelve un error, no lo repitas literal: explica el problema en palabras simples y ofrece otra opcion.${
    calendarRuntime.engine === "agenda" ? buildChangesContext(calendarRuntime) : ""
  }`;
}

function buildChangesContext(calendarRuntime: CalendarRuntimeView) {
  const upcoming = calendarRuntime.upcoming ?? [];
  const list =
    upcoming.length > 0
      ? upcoming.map((item) => `  - ${item.label}${item.service ? ` (${item.service})` : ""} -> inicio: ${item.startsAt}`).join("\n")
      : "  - (ninguna)";

  return `
- Citas próximas de este cliente:
${list}
- Para mover una cita: consultar_disponibilidad y, cuando elija, reagendar_cita. SOLO puedes decir que quedó cambiada si reagendar_cita respondió "confirmada": true y un "cita_id".
- Para cancelar: cancelar_cita, solo si el cliente lo pide claramente. SOLO puedes decir que quedó cancelada si cancelar_cita respondió "cancelada": true.`;
}

export function buildDirectBookingAnswer(
  result: Record<string, unknown>,
  runtime: CalendarRuntimeView,
) {
  if (
    result.confirmada === true &&
    typeof result.cita_id === "string" &&
    typeof result.inicio === "string"
  ) {
    const resultTimezone =
      typeof result.zona_horaria === "string"
        ? result.zona_horaria
        : runtime.timezone;
    const when = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: resultTimezone,
    }).format(new Date(result.inicio));
    const firstName = runtime.contact.fullName?.trim().split(/\s+/)[0];

    return result.reagendada === true
      ? `Listo${firstName ? `, ${firstName}` : ""}. Tu cita quedo cambiada para ${when}.`
      : `Listo${firstName ? `, ${firstName}` : ""}. Tu cita quedo agendada para ${when}.`;
  }

  const alternatives = Array.isArray(result.horarios_libres)
    ? result.horarios_libres
        .map((slot) =>
          slot && typeof slot === "object" && !Array.isArray(slot)
            ? String(
                (slot as Record<string, unknown>).hora ??
                  (slot as Record<string, unknown>).cuando ??
                  "",
              )
            : "",
        )
        .filter(Boolean)
    : [];

  if (alternatives.length > 0) {
    return `Ese horario ya no está libre. Para ese mismo dia tengo:\n${alternatives.map((time) => `- ${time}`).join("\n")}\nCual prefieres?`;
  }

  return "No pude registrar la cita en la agenda en este momento y no quedo agendada. Intenta de nuevo en un momento para volver a validarla.";
}

/** Respuesta a cancelar_cita, redactada por el servidor. */
export function buildDirectCancelAnswer(result: Record<string, unknown>, runtime: CalendarRuntimeView) {
  if (result.cancelada === true && typeof result.inicio === "string") {
    const timezone = typeof result.zona_horaria === "string" ? result.zona_horaria : runtime.timezone;
    const when = new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(
      new Date(result.inicio),
    );
    return `Listo, cancelé tu cita del ${when}. Si quieres otra fecha, dime y la buscamos.`;
  }

  if (Array.isArray(result.citas) && result.citas.length > 1) {
    return "Tienes varias citas próximas. ¿Cuál quieres cancelar?";
  }

  return "No pude cancelar la cita en este momento, así que sigue en pie. Intenta de nuevo en un momento o dime y lo revisa el equipo.";
}

export function buildDirectAvailabilityAnswer(
  result: Record<string, unknown>,
  runtime: CalendarRuntimeView,
) {
  if (typeof result.error === "string") {
    return "No pude consultar la agenda real en este momento. Intenta de nuevo en un momento y la reviso directamente.";
  }

  const timezone =
    typeof result.zona_horaria === "string"
      ? result.zona_horaria
      : runtime.timezone;
  const dateKey =
    typeof result.fecha_consultada === "string"
      ? result.fecha_consultada
      : null;
  const dayStart = dateKey ? zonedStartOfDay(dateKey, timezone) : null;
  const dateLabel = dayStart
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "full",
        timeZone: timezone,
      }).format(dayStart)
    : "ese día";
  const requestedTime =
    typeof result.hora_solicitada === "string" ? result.hora_solicitada : null;
  const requestedAvailable = result.horario_solicitado_disponible;
  const slots = Array.isArray(result.horarios)
    ? result.horarios
        .map((slot) =>
          slot && typeof slot === "object" && !Array.isArray(slot)
            ? String(
                (slot as Record<string, unknown>).hora ??
                  (slot as Record<string, unknown>).cuando ??
                  "",
              )
            : "",
        )
        .filter(Boolean)
    : [];

  if (requestedTime && requestedAvailable === true) {
    return `Sí, ${requestedTime} está disponible el ${dateLabel}. ¿Quieres que reserve esa hora?`;
  }

  if (requestedTime && requestedAvailable === false) {
    return slots.length > 0
      ? `${requestedTime} no está disponible el ${dateLabel}. Los horarios libres reales son:\n${slots.map((time) => `- ${time}`).join("\n")}\nCual prefieres?`
      : `${requestedTime} no está disponible el ${dateLabel} y no quedan otros horarios libres para ese dia.`;
  }

  return slots.length > 0
    ? `Para el ${dateLabel}, los horarios libres reales son:\n${slots.map((time) => `- ${time}`).join("\n")}\nCual prefieres?`
    : `No hay horarios libres para el ${dateLabel}. ¿Quieres que revise otro día?`;
}

export function textLooksLikeBookingClaim(text: string) {
  const normalized = normalizeClaimText(text);

  return [
    /\b(cita|llamada|sesion|reunion|consulta)\b.*\b(programad[ao]s?|agendad[ao]s?|reservad[ao]s?|confirmad[ao]s?|registrad[ao]s?)\b/,
    /\b(programad[ao]s?|agendad[ao]s?|reservad[ao]s?|confirmad[ao]s?|registrad[ao]s?)\b.*\b(cita|llamada|sesion|reunion|consulta)\b/,
    /\bqued[ao]\b.*\b(cita|llamada|sesion|reunion|consulta)\b/,
    /\bte espero\b.*\b(agenda|cita|llamada|sesion|reunion|consulta)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function textLooksLikeAvailabilityClaim(text: string) {
  const normalized = normalizeClaimText(text);

  return [
    /\b(tengo|tenemos|hay)\b.*\b(disponibilidad|disponible|libre|hueco|espacio)\b/,
    /\b(disponible|libre)\b.*\b(a las|para las|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo)\b/,
    /\b(puedo|podemos)\b.*\b(agendar|reservar|programar)\b.*\b(a las|para las)\b/,
    /\b(?:he|hemos)?\s*(?:consultado|revisado|verificado)\b.*\b(?:disponibilidad|agenda|horarios?)\b/,
    /\b(?:no hay|no tengo|no tenemos)\b.*\b(?:horarios?|disponibilidad|huecos?|espacios?)\b/,
    /\b(?:tengo|tenemos|hay|te dejo|estas son|estos son)\b.*\b(?:opciones?|horarios?)\b/,
    /\bhorarios?\b.*\b(?:disponibles?|libres?)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function hasConfirmedAppointment(toolCalls: Array<Record<string, unknown>>) {
  return toolCalls.some((call) => {
    const result =
      call.result && typeof call.result === "object" && !Array.isArray(call.result)
        ? (call.result as Record<string, unknown>)
        : {};

    return (
      (call.name === "agendar_cita" || call.name === "reagendar_cita") &&
      result.confirmada === true &&
      typeof result.cita_id === "string" &&
      result.cita_id.trim().length > 0
    );
  });
}

export function textLooksLikeCancellationClaim(text: string) {
  const normalized = normalizeClaimText(text);

  return [
    /\b(cita|llamada|sesion|reunion|consulta)\b.*\b(cancelad[ao]s?|anulad[ao]s?)\b/,
    /\b(cancele|he cancelado|hemos cancelado|anule|ya cancele)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function hasConfirmedCancellation(toolCalls: Array<Record<string, unknown>>) {
  return toolCalls.some((call) => {
    const result =
      call.result && typeof call.result === "object" && !Array.isArray(call.result)
        ? (call.result as Record<string, unknown>)
        : {};

    return call.name === "cancelar_cita" && result.cancelada === true;
  });
}

export function hasAvailabilityLookup(toolCalls: Array<Record<string, unknown>>) {
  return toolCalls.some((call) => {
    const result =
      call.result && typeof call.result === "object" && !Array.isArray(call.result)
        ? (call.result as Record<string, unknown>)
        : {};

    return (
      (call.name === "consultar_disponibilidad" &&
        !result.error &&
        Array.isArray(result.horarios)) ||
      (call.name === "agendar_cita" && Array.isArray(result.horarios_libres))
    );
  });
}

export function sanitizeCalendarAnswer({
  answer,
  calendarRuntime,
  toolCalls,
}: {
  answer: string;
  calendarRuntime: CalendarRuntimeView | null;
  toolCalls: Array<Record<string, unknown>>;
}) {
  const confirmedAppointment = hasConfirmedAppointment(toolCalls);

  if (textLooksLikeBookingClaim(answer) && !confirmedAppointment) {
    if (!calendarRuntime) {
      return {
        answer:
          "No tengo acceso a la agenda en este momento, así que no puedo confirmar ni registrar esa cita desde aquí. Te ayudo dejando la solicitud lista para que el equipo revise la agenda.",
        blockedReason:
          "Respuesta bloqueada: intentaba confirmar una cita sin calendario conectado para el agente.",
      };
    }

    return {
      answer:
        "No puedo confirmar esa cita todavía porque no tengo una confirmación real del calendario. Para ayudarte bien, voy a revisar disponibilidad y te confirmo solo cuando quede registrada.",
      blockedReason:
        "Respuesta bloqueada: intentaba confirmar una cita sin agendar_cita confirmada con cita_id.",
    };
  }

  if (textLooksLikeCancellationClaim(answer) && !hasConfirmedCancellation(toolCalls)) {
    return {
      answer:
        "Todavía no puedo darte la cita por cancelada porque no tengo la confirmación de la agenda. Lo reviso y te confirmo en cuanto quede cancelada.",
      blockedReason: "Respuesta bloqueada: decía que la cita estaba cancelada sin cancelar_cita confirmada.",
    };
  }

  if (
    calendarRuntime &&
    textLooksLikeAvailabilityClaim(answer) &&
    !hasAvailabilityLookup(toolCalls)
  ) {
    return {
      answer:
        "No pude consultar la agenda real en este momento, así que no voy a inventarte un horario. Intenta de nuevo en un momento y lo reviso directamente en el calendario.",
      blockedReason:
        "Respuesta bloqueada: mencionaba disponibilidad sin una consulta valida a la agenda.",
    };
  }

  if (!calendarRuntime && textLooksLikeAvailabilityClaim(answer)) {
    return {
      answer:
        "No tengo acceso a la agenda en este momento, así que no puedo confirmar disponibilidad ni reservar un horario desde aquí. Te ayudo dejando la solicitud lista para que el equipo revise la agenda.",
      blockedReason:
        "Respuesta bloqueada: mencionaba disponibilidad sin calendario conectado para el agente.",
    };
  }

  return { answer, blockedReason: null };
}
