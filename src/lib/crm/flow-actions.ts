import type { FlowCrmAction } from "../flow-definitions.ts";
import { contactEmailVariables, sendContactEmail, type ContactEmailDeps } from "./contact-email.ts";
import { updateContact } from "./contacts.ts";
import { dbFailure, invalid, notFound } from "./errors.ts";
import { addNote } from "./notes.ts";
import type { CrmActor, CrmClient } from "./shared.ts";
import { findStageByName, setContactStage } from "./stages.ts";
import { addTagToContact, createTag, findTagsByNames, listTags, removeTagFromContact } from "./tags.ts";
import { createTask } from "./tasks.ts";

/**
 * Acciones del CRM que ejecuta un paso de flujo (`crm_action`, o las acciones
 * de GHL convertidas). Cada acción va por separado: una que falla no impide las
 * demás, y el resultado dice cuál falló y por qué.
 *
 * `addedTagIds` son las etiquetas que el contacto NO tenía y ahora sí: con
 * ellas se disparan los flujos con trigger `tag` (y solo con ellas, para que
 * volver a poner una etiqueta no relance nada).
 */

const FLOW_ACTOR: CrmActor = { kind: "flow" };
const BASE_FIELDS: Record<string, "company" | "email" | "fullName"> = {
  company: "company",
  email: "email",
  full_name: "fullName",
  nombre: "fullName",
};

export type FlowActionResult = { action: string; error?: string; ok: boolean; detail?: string };

/** `{{clave}}` → respuesta del flujo con esa clave (vacío si no hay). */
export function renderFlowTemplate(value: string | undefined, answers: Record<string, unknown>) {
  return (value ?? "").replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const answer = answers[key];
    return answer === undefined || answer === null ? "" : String(answer);
  });
}

async function resolveTag(client: CrmClient, workspaceId: string, action: FlowCrmAction, createIfMissing: boolean) {
  if (action.tagId) {
    const tag = (await listTags(client, workspaceId)).find((item) => item.id === action.tagId);
    if (!tag) {
      throw notFound("Esa etiqueta ya no existe.");
    }
    return tag;
  }

  const name = action.tagName?.trim();

  if (!name) {
    throw invalid("Falta la etiqueta.");
  }

  const [existing] = await findTagsByNames(client, workspaceId, [name]);

  if (existing) {
    return existing;
  }

  return createIfMissing ? createTag(client, workspaceId, { name }) : null;
}

export async function runCrmFlowActions(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  actions: FlowCrmAction[],
  answers: Record<string, unknown> = {},
  deps: ContactEmailDeps = {},
) {
  const results: FlowActionResult[] = [];
  const addedTagIds: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "add_tag": {
          const tag = await resolveTag(client, workspaceId, action, true);
          const { added } = await addTagToContact(client, workspaceId, contactId, tag!.id, FLOW_ACTOR);
          if (added) addedTagIds.push(tag!.id);
          results.push({ action: action.type, detail: tag!.name, ok: true });
          break;
        }
        case "remove_tag": {
          const tag = await resolveTag(client, workspaceId, action, false);
          if (tag) await removeTagFromContact(client, workspaceId, contactId, tag.id, FLOW_ACTOR);
          results.push({ action: action.type, detail: tag?.name ?? action.tagName, ok: true });
          break;
        }
        case "set_stage": {
          const stageId = action.stageId ?? (action.stageName ? (await findStageByName(client, workspaceId, action.stageName))?.id : undefined);
          if (!stageId) throw invalid(`La etapa «${action.stageName ?? ""}» no existe.`);
          const { stage } = await setContactStage(client, workspaceId, contactId, stageId, FLOW_ACTOR);
          results.push({ action: action.type, detail: stage.name, ok: true });
          break;
        }
        case "update_contact_field": {
          const key = action.fieldKey?.trim();
          if (!key) throw invalid("Falta el campo.");
          const value = renderFlowTemplate(action.fieldValue, answers);
          const base = BASE_FIELDS[key];
          await updateContact(
            client,
            workspaceId,
            contactId,
            base ? { [base]: value } : { customFields: { [key]: value } },
            FLOW_ACTOR,
          );
          results.push({ action: action.type, detail: key, ok: true });
          break;
        }
        case "create_task": {
          const days = Number(action.taskDueInDays);
          await createTask(
            client,
            workspaceId,
            contactId,
            {
              dueAt: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
              title: renderFlowTemplate(action.taskTitle, answers),
            },
            FLOW_ACTOR,
          );
          results.push({ action: action.type, ok: true });
          break;
        }
        case "add_note": {
          await addNote(client, workspaceId, contactId, renderFlowTemplate(action.noteBody, answers), FLOW_ACTOR);
          results.push({ action: action.type, ok: true });
          break;
        }
        case "send_email": {
          const variables = { ...(await contactEmailVariables(client, workspaceId, contactId)), ...answers };
          const sent = await sendContactEmail(
            client,
            workspaceId,
            contactId,
            { body: renderFlowTemplate(action.emailBody, variables), subject: renderFlowTemplate(action.emailSubject, variables) },
            FLOW_ACTOR,
            deps,
          );
          results.push({ action: action.type, detail: sent.to, ok: true });
          break;
        }
        case "set_booking_agenda": {
          if (!action.agendaId) throw invalid("Falta la agenda.");
          const { data: agenda, error: agendaError } = await client
            .from("agendas")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("id", action.agendaId)
            .maybeSingle();
          if (agendaError) throw dbFailure("flowAction.agenda", agendaError);
          if (!agenda) throw notFound("Esa agenda ya no existe.");
          const { data: contact, error } = await client
            .from("contacts")
            .select("metadata")
            .eq("workspace_id", workspaceId)
            .eq("id", contactId)
            .maybeSingle();
          if (error) throw dbFailure("flowAction.contact", error);
          if (!contact) throw notFound("Ese contacto no existe en esta empresa.");
          const metadata = (contact as { metadata: unknown }).metadata;
          const current = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
          await client
            .from("contacts")
            .update({ metadata: { ...current, booking_agenda_id: action.agendaId } })
            .eq("workspace_id", workspaceId)
            .eq("id", contactId);
          results.push({ action: action.type, detail: action.agendaId, ok: true });
          break;
        }
        default:
          results.push({ action: String((action as { type?: unknown }).type), error: "Acción desconocida.", ok: false });
      }
    } catch (error) {
      // CrmError y los de Google traen un mensaje que se puede enseñar.
      const userFacing = (error as { userFacing?: boolean }).userFacing === true;
      if (!userFacing) {
        console.error("[flow-actions]", action.type, error);
      }
      results.push({
        action: action.type,
        error: userFacing ? (error as Error).message : "Error inesperado al ejecutar la acción.",
        ok: false,
      });
    }
  }

  return { addedTagIds, results };
}
