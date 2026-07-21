import type { Json } from "@/lib/supabase/database.types";

export type FlowStatus = "active" | "archived" | "draft" | "paused";
export type FlowTriggerType = "first_inbound" | "keyword" | "manual" | "tag" | "webhook";
export type FlowStepType =
  | "agent"
  | "condition"
  | "finish"
  | "ghl_action"
  | "human"
  | "message"
  | "options"
  | "question"
  | "wait"
  | "webhook";

export type FlowGhlAction = {
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
    | "upsert_opportunity"
    | "update_contact_field";
};

export type FlowOption = {
  label: string;
  nextStepId?: string;
  value: string;
};

export type FlowStep = {
  actions?: FlowGhlAction[];
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
    label: "Diagnostico",
  },
  {
    description: "Prueba, video, metodologia o autoridad.",
    key: "nutricion",
    label: "Nutricion",
  },
  {
    description: "Calificacion, agenda y handoff.",
    key: "conversion",
    label: "Conversion",
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
    label: "Diagnostico",
  },
  {
    description: "Sincronizacion con GHL y enlace de agenda.",
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
  { description: "Envia texto por WhatsApp desde YCloud.", label: "Mensaje", value: "message" },
  { description: "Pregunta y guarda la siguiente respuesta.", label: "Pregunta", value: "question" },
  { description: "Muestra opciones y ramifica.", label: "Opciones", value: "options" },
  { description: "Evalua campos, tags o respuestas.", label: "Condicion", value: "condition" },
  { description: "Espera antes de avanzar.", label: "Espera", value: "wait" },
  { description: "Ejecuta tags, campos, tareas u oportunidad.", label: "Accion GHL", value: "ghl_action" },
  { description: "Llama una URL externa.", label: "Webhook", value: "webhook" },
  { description: "Transfiere al router de agentes IA.", label: "Agente IA", value: "agent" },
  { description: "Pausa bot/IA para atencion humana.", label: "Humano", value: "human" },
  { description: "Marca el flujo como completado.", label: "Finalizar", value: "finish" },
];

export const defaultLevyFlowSteps: FlowStep[] = [
  {
    fieldKey: "tipo_negocio",
    id: "tipo_negocio",
    message:
      "Hola {{firstName}}. Para preparar mejor nuestra conversacion, quiero hacerte unas preguntas breves.\n\nQue tipo de negocio tienes?",
    name: "Bienvenida y tipo de negocio",
    nextStepId: "cuello_botella",
    options: [
      { label: "Clinica", nextStepId: "cuello_botella", value: "clinica" },
      { label: "Agencia", nextStepId: "cuello_botella", value: "agencia" },
      { label: "Asesorias", nextStepId: "cuello_botella", value: "asesorias" },
      { label: "Otros", nextStepId: "tipo_negocio_otro", value: "otros" },
    ],
    requiredForStage: true,
    stageKey: "inicio",
    type: "options",
  },
  {
    fieldKey: "tipo_negocio",
    id: "tipo_negocio_otro",
    message: "Cuentame brevemente que tipo de negocio tienes.",
    name: "Aclarar otro tipo de negocio",
    nextStepId: "cuello_botella",
    requiredForStage: false,
    stageKey: "inicio",
    type: "question",
    retryMessage:
      "Necesito una respuesta un poco mas completa. Cuentame que servicio vendes y a quien.",
    validationCriteria:
      "Debe identificar un negocio o actividad de servicios real. No basta una palabra vaga sin contexto.",
    validationEnabled: true,
    validationMinLength: 8,
  },
  {
    fieldKey: "cuello_botella",
    id: "cuello_botella",
    message: "Que tarea te esta quitando mas tiempo ahora mismo?",
    name: "Preguntar cuello de botella",
    nextStepId: "herramientas",
    options: [
      {
        label: "Correos y WhatsApp",
        nextStepId: "herramientas",
        value: "contestar_correos_whatsapp",
      },
      { label: "Facturacion", nextStepId: "herramientas", value: "facturacion" },
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
    message: "Cuentame brevemente cual es esa otra tarea o problema.",
    name: "Aclarar otro cuello de botella",
    nextStepId: "herramientas",
    requiredForStage: false,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Ayudame con un ejemplo concreto: que tarea repetitiva te quita tiempo y que ocurre hoy cuando la haces?",
    validationCriteria:
      "Debe describir una tarea, proceso o problema operativo concreto que consume tiempo.",
    validationEnabled: true,
    validationMinLength: 12,
  },
  {
    fieldKey: "herramientas_actuales",
    id: "herramientas",
    message: "Que herramientas usas hoy para gestionarlo? Por ejemplo WhatsApp, agenda, Excel, email, Instagram o CRM.",
    name: "Preguntar herramientas actuales",
    nextStepId: "horas_perdidas",
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Dime al menos una herramienta que uses hoy, por ejemplo WhatsApp, Excel, agenda, email, Instagram o un CRM.",
    validationCriteria:
      "Debe mencionar al menos una herramienta, canal o metodo actual de trabajo.",
    validationEnabled: true,
    validationMinLength: 3,
  },
  {
    fieldKey: "horas_perdidas",
    id: "horas_perdidas",
    message: "Cuantas horas a la semana te quita aproximadamente?",
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
    message: "Que te gustaria haber mejorado en tu negocio durante los proximos 30 dias?",
    name: "Guardar objetivo a 30 dias",
    nextStepId: "tag_diagnostico",
    requiredForStage: true,
    stageKey: "diagnostico",
    type: "question",
    retryMessage:
      "Piensa en un cambio concreto dentro de 30 dias: que podrias hacer mejor con ese tiempo recuperado?",
    validationCriteria:
      "Debe expresar un resultado operativo o personal concreto que espera lograr en 30 dias.",
    validationEnabled: true,
    validationMinLength: 12,
  },
  {
    actions: [
      {
        label: "Tag diagnostico completado",
        tag: "levy_diagnostico_iniciado",
        type: "add_tag",
      },
    ],
    id: "tag_diagnostico",
    name: "GHL: diagnostico completado",
    nextStepId: "enlace_agenda",
    requiredForStage: true,
    stageKey: "conversion",
    type: "ghl_action",
  },
  {
    id: "enlace_agenda",
    message:
      "Gracias, {{firstName}}. Ya tengo la informacion necesaria para la llamada.\n\nPuedes elegir el horario que mejor te funcione aqui:\nhttps://momentiacitas.ruralketing.com/agenda-tu-cita#row-g6WOTuqARq",
    name: "Enviar enlace de agenda",
    nextStepId: "transferir_citas",
    requiredForStage: true,
    stageKey: "conversion",
    type: "message",
    waitForInbound: false,
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
    message: "Escribe aqui el mensaje que vera el contacto.",
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
