/** Tipos que comparten la página de Clientes y la ficha (sin importar código de servidor). */

export type CrmStageOption = { color: string; id: string; kind: "lost" | "open" | "won"; name: string; position: number };
export type CrmTagOption = { color: string; id: string; name: string };
export type CrmFieldOption = {
  active: boolean;
  ai_readable: boolean;
  id: string;
  key: string;
  label: string;
  options: string[];
  position: number;
  type: string;
};

export type CrmPanelOptions = {
  customFields: CrmFieldOption[];
  stages: CrmStageOption[];
  tags: CrmTagOption[];
};

export type ContactListItem = {
  company: string | null;
  created_at: string;
  custom_fields: Record<string, unknown>;
  email: string | null;
  full_name: string | null;
  id: string;
  last_message_at: string | null;
  phone_e164: string;
  source: string | null;
  stage: CrmStageOption | null;
  stage_id: string | null;
  tags: CrmTagOption[];
};

export type ContactCard = {
  activity: Array<{ actor: string; created_at: string; data: unknown; id: string; kind: string }>;
  appointments: Array<{ created_by: string; ends_at: string; id: string; service: string; starts_at: string; status: string }>;
  contact: Omit<ContactListItem, "stage" | "tags">;
  conversationId: string | null;
  customFields: CrmFieldOption[];
  notes: Array<{ author_id: string | null; body: string; created_at: string; id: string }>;
  stage: CrmStageOption | null;
  stages: CrmStageOption[];
  tags: CrmTagOption[];
  tasks: Array<{ completed_at: string | null; due_at: string | null; id: string; title: string }>;
};
