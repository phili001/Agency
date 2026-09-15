/**
 * Guias de la primera vez en cada pantalla. Cada paso apunta a un elemento con
 * `data-tour="<target>"`; si no existe (p. ej. la bandeja está vacía) se salta.
 * Texto para dueños de negocio: sin jerga, una idea por paso.
 */
export type TourStep = {
  body: string;
  target: string;
  title: string;
};

export type TourKey = "agents" | "inbox";

export const tours: Record<TourKey, { steps: TourStep[]; title: string }> = {
  inbox: {
    steps: [
      {
        body: "Aquí llegan todos los chats de tu WhatsApp. Se reparten en tres pestañas: los que la IA está respondiendo, los que esperan a una persona (Handoff) y los que van dentro de un flujo guiado.",
        target: "inbox-tabs",
        title: "Tu bandeja de chats",
      },
      {
        body: "Toca un chat para abrirlo. Verás quién escribe, un resumen y si lo atiende la IA o una persona.",
        target: "conversation-list",
        title: "Lista de conversaciones",
      },
      {
        body: "Con este botón enciendes o apagas la IA solo en este chat. Si la apagas, nadie responde hasta que lo hagas tú o la vuelvas a encender.",
        target: "ai-toggle",
        title: "Encender o apagar la IA",
      },
      {
        body: "Pasa el chat a la pestaña Handoff para que una persona del equipo lo atienda. La IA también lo hace sola si el cliente pide hablar con alguien.",
        target: "handoff-button",
        title: "Pasar a una persona",
      },
      {
        body: "Escribe aquí para responder tú mismo por WhatsApp. El cliente lo recibe como cualquier otro mensaje.",
        target: "composer",
        title: "Responder a mano",
      },
      {
        body: "Las notas internas se quedan en Levy: el cliente nunca las ve. Úsalas para dejar contexto a tu equipo.",
        target: "internal-note",
        title: "Notas para tu equipo",
      },
      {
        body: "Datos del contacto, resumen que hace la IA y etiquetas. Si conectaste GoHighLevel, aquí ves si ya está sincronizado.",
        target: "contact-panel",
        title: "Ficha del contacto",
      },
    ],
    title: "Cómo usar la bandeja",
  },
  agents: {
    steps: [
      {
        body: "Cada agente atiende un tipo de conversación: información, ventas o citas. Toca uno para ver y cambiar su configuración.",
        target: "agent-list",
        title: "Tus agentes",
      },
      {
        body: "El nombre y el cargo con los que se presenta al cliente. Cámbialos para que suenen como tu equipo.",
        target: "agent-identity",
        title: "Cómo se presenta",
      },
      {
        body: "Qué debe hacer siempre y qué no debe hacer nunca. Escríbelo en lenguaje normal, como instrucciones a un empleado nuevo.",
        target: "agent-rules",
        title: "Reglas y límites",
      },
      {
        body: "Escribe un mensaje como si fueras un cliente y mira cómo respondería el agente antes de que hable con gente real.",
        target: "agent-test",
        title: "Pruébalo antes",
      },
    ],
    title: "Cómo configurar tus agentes",
  },
};

export function getSeenTours(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.levy_tours;

  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(
          ([, seenAt]) => typeof seenAt === "string",
        ),
      ) as Record<string, string>
    : {};
}
