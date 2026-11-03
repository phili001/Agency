import type { Json } from "@/lib/supabase/database.types";

export type FlowStatus = "active" | "archived" | "draft" | "paused";
export type FlowTriggerType = "first_inbound" | "keyword" | "manual" | "tag" | "webhook";
export type FlowStepType =
  | "agent"
  | "condition"
  | "crm_action"
  | "finish"
  | "ghl_action"
  | "human"
  | "message"
  | "options"
  | "question"
  | "wait"
  | "webhook";

export type FlowGhlAction = {
  /** Calendario que usara el agente de citas para este contacto. */
  calendarId?: string;
  customFieldKey?: string;
  customFieldValue?: string;
  label: string;
  pipelineId?: string;
  stageId?: string;
  tag?: string;
  taskTitle?: string;
  type:
    | "add_tag"
    | "create_task"
    | "remove_tag"
    | "set_booking_calendar"
    | "upsert_opportunity"
    | "update_contact_field";
};

/**
 * Acción del CRM propio (F5.3). Sustituye a `FlowGhlAction`: los flujos
 * guardados con acciones de GoHighLevel se siguen leyendo; mientras el
 * workspace tenga GHL conectado se ejecutan en GHL y, si no, se convierten
 * (`convertGhlActionToCrm`) y van al CRM.
 */
export type FlowCrmActionType =
  | "add_note"
  | "add_tag"
  | "create_task"
  | "remove_tag"
  | "set_booking_agenda"
  | "set_stage"
  | "update_contact_field";

export type FlowCrmAction = {
  /** Agenda que usará el agente de citas para este contacto. */
  agendaId?: string;
  engine: "crm";
  /** Clave de campo personalizado o `full_name` / `email` / `company`. */
  fieldKey?: string;
  /** Valor; admite `{{respuesta}}` con las respuestas del flujo. */
  fieldValue?: string;
  label: string;
  noteBody?: string;
  stageId?: string;
  /** Nombre de la etapa (lo que deja la conversión desde GHL). */
  stageName?: string;
  tagId?: string;
  /** Nombre de la etiqueta (si no existe, `add_tag` la crea). */
  tagName?: string;
  taskDueInDays?: number;
  taskTitle?: string;
  type: FlowCrmActionType;
};

export type FlowAction = FlowCrmAction | FlowGhlAction;

export const crmActionTypes: Array<{ label: string; value: FlowCrmActionType }> = [
  { label: "Poner etiqueta", value: "add_tag" },
  { label: "Quitar etiqueta", value: "remove_tag" },
  { label: "Cambiar etapa", value: "set_stage" },
  { label: "Actualizar campo", value: "update_contact_field" },
  { label: "Crear tarea", value: "create_task" },
  { label: "Añadir nota", value: "add_note" },
  { label: "Cambiar agenda de citas", value: "set_booking_agenda" },
];

export function isCrmAction(action: unknown): action is FlowCrmAction {
  return Boolean(action) && typeof action === "object" && (action as { engine?: unknown }).engine === "crm";
}

/**
 * Acción de GHL → acción del CRM. Las etiquetas, campos y tareas pasan tal
 * cual (por nombre/clave). `upsert_opportunity` y `set_booking_calendar` usan
 * ids de GoHighLevel que no existen en el CRM: devuelven null (hay que
 * rehacerlas a mano con una etapa o agenda del CRM).
 */
export function convertGhlActionToCrm(action: FlowGhlAction): FlowCrmAction | null {
  const label = action.label || "Acción";

  switch (action.type) {
    case "add_tag":
    case "remove_tag":
      return action.tag?.trim() ? { engine: "crm", label, tagName: action.tag.trim(), type: action.type } : null;
    case "update_contact_field":
      return action.customFieldKey?.trim()
        ? { engine: "crm", fieldKey: action.customFieldKey.trim(), fieldValue: action.customFieldValue ?? "", label, type: "update_contact_field" }
        : null;
    case "create_task":
      return action.taskTitle?.trim() ? { engine: "crm", label, taskTitle: action.taskTitle.trim(), type: "create_task" } : null;
    default:
      return null;
  }
}

/** Acciones de un paso, separadas en las del CRM y las viejas de GHL. */
export function splitStepActions(actions: unknown) {
  const list = Array.isArray(actions) ? actions : [];
  return {
    crm: list.filter(isCrmAction),
    legacy: list.filter((action): action is FlowGhlAction => !isCrmAction(action) && Boolean(action) && typeof action === "object"),
  };
}

/**
 * ¿Dispara este flujo (trigger `tag`) alguna de estas etiquetas recién puestas?
 * Por id (`tagId`) o por nombre (`tag`, sin mayúsculas: flujos viejos o de GHL).
 */
export function flowMatchesTags(
  triggerConfig: unknown,
  tags: Array<{ id: string; name: string }>,
) {
  const config =
    triggerConfig && typeof triggerConfig === "object" && !Array.isArray(triggerConfig)
      ? (triggerConfig as Record<string, unknown>)
      : {};
  const tagId = typeof config.tagId === "string" ? config.tagId : "";
  const tagName = typeof config.tag === "string" ? config.tag.trim().toLowerCase() : "";

  return tags.some((tag) => (tagId && tag.id === tagId) || (tagName && tag.name.trim().toLowerCase() === tagName));
}

export type FlowOption = {
  label: string;
  nextStepId?: string;
  value: string;
};

export type FlowStep = {
  actions?: FlowAction[];
  agentId?: string;
  fieldKey?: string;
  id: string;
  message?: string;
  name: string;
  nextStepId?: string;
  options?: FlowOption[];
  retryMessage?: string;
  requiredForStage?: boolean;
  stageKey?: string;
  type: FlowStepType;
  validationCriteria?: string;
  validationEnabled?: boolean;
  validationMinLength?: number;
  waitAmount?: number;
  waitUnit?: "days" | "hours" | "minutes";
  waitForInbound?: boolean;
  webhookBody?: Json;
  webhookUrl?: string;
};

export type FlowStage = {
  description: string;
  key: string;
  label: string;
};

export const defaultFlowStages: FlowStage[] = [
  {
    description: "Primer contacto y contexto inicial.",
    key: "inicio",
    label: "Inicio",
  },
  {
    description: "Preguntas para entender negocio, dolor y urgencia.",
    key: "diagnostico",
    label: "Diagnóstico",
  },
  {
    description: "Prueba, vídeo, metodología o autoridad.",
    key: "nutricion",
    label: "Nutrición",
  },
  {
    description: "Calificación, agenda y handoff.",
    key: "conversion",
    label: "Conversión",
  },
  {
    description: "Cierre del flujo o transferencia.",
    key: "cierre",
    label: "Cierre",
  },
];

export const defaultLevyFlowStages: FlowStage[] = [
  {
    description: "Tipo de negocio y contexto inicial.",
    key: "inicio",
    label: "Inicio",
  },
  {
    description: "Cuello de botella, herramientas, tiempo y objetivo.",
    key: "diagnostico",
    label: "Diagnóstico",
  },
  {
    description: "Etiquetas en el CRM y enlace de agenda.",
    key: "conversion",
    label: "Agenda",
  },
  {
    description: "Transferencia al inbox normal.",
    key: "cierre",
    label: "Cierre",
  },
];

export type FlowRecord = {
  created_at?: string;
  description: string;
  id: string;
  metrics?: Json;
  name: string;
  status: FlowStatus;
  steps: FlowStep[];
  trigger_config: Record<string, Json>;
  trigger_type: FlowTriggerType;
  updated_at?: string;
  workspace_id: string;
};

export type FlowAudience = "all" | "labels" | "manual" | "new_contacts";

export const flowStepTypes: Array<{
  description: string;
  label: string;
  value: FlowStepType;
}> = [
  { description: "Envía texto por WhatsApp desde YCloud.", label: "Mensaje", value: "message" },
  { description: "Pregunta y guarda la siguiente respuesta.", label: "Pregunta", value: "question" },
  { description: "Muestra opciones y ramifica.", label: "Opciones", value: "options" },
  { description: "Evalúa campos, tags o respuestas.", label: "Condición", value: "condition" },
  { description: "Espera antes de avanzar.", label: "Espera", value: "wait" },
  { description: "Etiquetas, etapa, campos, tareas, notas o agenda del contacto.", label: "Acción CRM", value: "crm_action" },
  { description: "Llama a una URL externa.", label: "Webhook", value: "webhook" },
  { description: "Transfiere al router de agentes IA.", label: "Agente IA", value: "agent" },
  { description: "Pausa bot/IA para atención humana.", label: "Humano", value: "human" },
  { description: "Marca el flujo como completado.", label: "Finalizar", value: "finish" },
];

export const defaultLevyFlowSteps: FlowStep[] = [
  {
    fieldKey: "tipo_negocio",
    id: "tipo_negocio",
    message:
      "Hola {{firstName}}. En menos de 2 minutos vamos a ponerle un número al tiempo que hoy se está escapando de tu negocio.\n\nPara empezar, ¿qué tipo de negocio tienes?",
    name: "Bienvenida y tipo de negocio",
    nextStepId: "cuello_botella",
    options: [
      { label: "Clínica", nextStepId: "cuello_botella", value: "clinica" },
      { label: "Agencia", nextStepId: "cuello_botella", value: "agencia" },
      { label: "Asesorías", nextStepId: "cuello_botella", value: "asesorias" },
      { label: "Otros", nextStepId: "tipo_negocio_otro", value: "otros" },
    ],
    requiredForStage: true,
    stageKey: "inicio",
    type: "options",
  },
  {
    fieldKey: "tipo_negocio",
    id: "tipo_negocio_otro",
    message: "Cuéntame brevemente qué tipo de negocio tienes.",
    name: "Aclarar otro tipo de negocio",
    nextStepId: "cuello_botella",
    requiredForStage: false,
    stageKey: "inicio",
    type: "question",
    retryMessage:
      "Necesito una respuesta un poco más completa. Cuéntame qué servicio vendes y a quién.",
    validationCriteria:
      "Debe identificar un negocio o actividad de servicios real. No basta una palabra vaga sin contexto.",
    validationEnabled: true,
    validationMinLength: 8,
  },
  {
    fieldKey: "cuello_botella",
    id: "cuello_botella",
    message: "Ahora vamos al punto importante: ¿qué tarea repetitiva te está quitando más tiempo cada semana?",
    name: "Preguntar cuello de botella",
    nextStepId: "herramientas",
    options: [
      {
        label: "Correos y WhatsApp",
        nextStepId: "herramientas",
        value: "contestar_correos_whatsapp",
      },
      { label: "Facturación", nextStepId: "herramientas", value: "facturacion" },
      {
        label: "Planificar tareas",
        nextStepId: "herramientas",
        value: "planificar_tareas",
      },
      { label: "Otro", nextStepId: "cuello_botella_otro", value: "otro" },
    ],
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "options",
  },
  {
    fieldKey: "cuello_botella",
    id: "cuello_botella_otro",
    message: "Cuéntame brevemente cuál es esa otra tarea o problema.",
    name: "Aclarar otro cuello de botella",
    nextStepId: "herramientas",
    requiredForStage: false,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Ayúdame con un ejemplo concreto: ¿qué tarea repetitiva te quita tiempo y qué ocurre hoy cuando la haces?",
    validationCriteria:
      "Debe describir una tarea, proceso o problema operativo concreto que consume tiempo.",
    validationEnabled: true,
    validationMinLength: 12,
  },
  {
    fieldKey: "herramientas_actuales",
    id: "herramientas",
    message: "¿Con qué herramientas intentas gestionarla hoy? Por ejemplo WhatsApp, agenda, Excel, email, Instagram o CRM.",
    name: "Preguntar herramientas actuales",
    nextStepId: "horas_perdidas",
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Dime al menos una herramienta que uses hoy: WhatsApp, Excel, agenda, email, Instagram o un CRM.",
    validationCriteria:
      "Debe mencionar al menos una herramienta, canal o método actual de trabajo.",
    validationEnabled: true,
    validationMinLength: 3,
  },
  {
    fieldKey: "horas_perdidas",
    id: "horas_perdidas",
    message: "Hagamos visible esa fuga: ¿cuántas horas a la semana te consume aproximadamente?",
    name: "Preguntar horas perdidas",
    nextStepId: "objetivo_30_dias",
    options: [
      { label: "1-5 horas", nextStepId: "objetivo_30_dias", value: "1-5" },
      { label: "5-10 horas", nextStepId: "objetivo_30_dias", value: "5-10" },
      { label: "10-20 horas", nextStepId: "objetivo_30_dias", value: "10-20" },
      { label: "+20 horas", nextStepId: "objetivo_30_dias", value: "+20" },
    ],
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "options",
  },
  {
    fieldKey: "objetivo_30_dias",
    id: "objetivo_30_dias",
    message: "Si recuperaras parte de ese tiempo durante los próximos 30 días, ¿qué cambiaría primero en tu negocio?",
    name: "Guardar objetivo a 30 días",
    nextStepId: "valor_hora",
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Piensa en un cambio concreto dentro de 30 días: ¿qué podrías hacer mejor con ese tiempo recuperado?",
    validationCriteria:
      "Debe expresar un resultado operativo o personal concreto que espera lograr en 30 días.",
    validationEnabled: true,
    validationMinLength: 12,
  },
  {
    fieldKey: "valor_hora",
    id: "valor_hora",
    message:
      "Último dato para calcular el costo oculto: ¿cuánto vale aproximadamente una hora tuya o de la persona que hace esa tarea?\n\nResponde con importe y moneda. Ejemplos: 25 USD, 20 EUR o 50000 COP.",
    name: "Calcular valor de la hora",
    nextStepId: "impacto_operativo",
    requiredForStage: true,
    retryMessage:
      "Escribe un valor numérico y la moneda. Por ejemplo: 25 USD, 20 EUR o 50000 COP.",
    stageKey: "diagnostico",
    type: "question",
    validationCriteria:
      "Debe contener un valor numérico positivo y una moneda como USD, EUR, COP o MXN.",
    validationEnabled: true,
    validationMinLength: 4,
  },
  {
    id: "impacto_operativo",
    message:
      "*Aquí está la fuga que hoy no se ve:*\n\nTiempo consumido: {{horas_mensuales_estimadas}} al mes.\nCosto mensual estimado: {{costo_mensual_estimado}}.\nCosto anual estimado: {{costo_anual_estimado}}.\n\nY eso sin contar errores, retrasos ni oportunidades que no puedes atender mientras repites la misma tarea.\n\nYa tienes una primera radiografía del problema. En la reunión revisaremos qué conviene automatizar primero y si podemos convertir esta fuga en tiempo útil para vender, atender o crecer.\n\n{{booking_cta}}",
    name: "Mostrar costo oculto del proceso",
    nextStepId: "tag_diagnostico",
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "message",
    waitForInbound: false,
  },
  {
    actions: [
      {
        engine: "crm",
        label: "Etiqueta diagnóstico completado",
        tagName: "levy_diagnostico_iniciado",
        type: "add_tag",
      },
    ],
    id: "tag_diagnostico",
    name: "CRM: diagnóstico completado",
    nextStepId: "transferir_citas",
    requiredForStage: true,
    stageKey: "conversion",
    type: "crm_action",
  },
  {
    id: "transferir_citas",
    name: "Transferir a agente de citas",
    requiredForStage: true,
    stageKey: "cierre",
    type: "agent",
  },
];

export function createBlankStep(index: number): FlowStep {
  return {
    id: `paso_${index + 1}_${crypto.randomUUID().slice(0, 8)}`,
    message: "Escribe aquí el mensaje que verá el contacto.",
    name: `Paso ${index + 1}`,
    requiredForStage: true,
    stageKey: "inicio",
    type: "message",
    waitForInbound: true,
  };
}

export function parseFlowSteps(value: Json): FlowStep[] {
  return Array.isArray(value) ? (value as FlowStep[]) : [];
}
