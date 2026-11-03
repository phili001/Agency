import { upsertContactByPhone, updateContact } from "../crm/contacts.ts";
import { createCustomField, listCustomFields } from "../crm/custom-fields.ts";
import { normalizeEmail } from "../crm/normalize.ts";
import type { CrmActor, CrmClient } from "../crm/shared.ts";
import { findStageByName, setContactStage } from "../crm/stages.ts";
import { addTagToContact, createTag, findTagsByNames, removeTagFromContact } from "../crm/tags.ts";
import type { StripeSubscriptionStatus } from "./state.ts";

/**
 * El comprador de Levy como contacto en el CRM de la agencia (AAA001,
 * `LEVY_WORKSPACE_CODE`). Solo se escribe en ese CRM; nunca se leen datos del
 * CRM del cliente. Sustituye a las etiquetas que antes se ponían en GHL.
 */

export const LEVY_TAGS = { active: "cliente-levy", canceled: "levy-cancelado", pastDue: "levy-impago" } as const;
const STAGES = { active: "Cliente", canceled: "Perdido" } as const;
const FIELDS = [
  { key: "levy_company_code", label: "Levy: código de empresa" },
  { key: "levy_workspace_id", label: "Levy: id de empresa" },
  { key: "levy_plan", label: "Levy: plan" },
] as const;
const STRIPE_ACTOR: CrmActor = { kind: "stripe" };

export type AgencyContactInput = {
  companyCode: string | null;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  plan?: string | null;
  status: StripeSubscriptionStatus | "paid";
  workspaceId: string;
};

export type AgencyContactResult =
  | { contactId: string; ok: true }
  | { ok: false; reason: "no_agency_workspace" | "no_contact_without_phone" };

export function agencyWorkspaceCode(env: Record<string, string | undefined> = process.env) {
  return env.LEVY_WORKSPACE_CODE?.trim() || "AAA001";
}

function bucket(status: AgencyContactInput["status"]): keyof typeof LEVY_TAGS | null {
  if (status === "paid" || status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "pastDue";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return null;
}

async function ensureTag(client: CrmClient, workspaceId: string, name: string) {
  const [existing] = await findTagsByNames(client, workspaceId, [name]);
  if (existing) return existing;
  try {
    return await createTag(client, workspaceId, { name });
  } catch {
    // Creada a la vez por otro evento.
    const [again] = await findTagsByNames(client, workspaceId, [name]);
    if (!again) throw new Error(`No se pudo crear la etiqueta ${name}.`);
    return again;
  }
}

async function ensureFields(client: CrmClient, workspaceId: string) {
  const current = await listCustomFields(client, workspaceId, { includeInactive: true });
  for (const field of FIELDS) {
    if (!current.some((item) => item.key === field.key)) {
      try {
        await createCustomField(client, workspaceId, { ai_readable: false, key: field.key, label: field.label, type: "text" });
      } catch {
        // Ya existe (otro evento a la vez): se sigue.
      }
    }
  }
  const after = await listCustomFields(client, workspaceId);
  return new Set(after.map((item) => item.key));
}

async function findContactId(client: CrmClient, workspaceId: string, input: AgencyContactInput) {
  const email = normalizeEmail(input.email);
  if (email) {
    const { data, error } = await client
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(`agency contact lookup: ${error.message}`);
    const found = (data ?? [])[0] as { id: string } | undefined;
    if (found) return found.id;
  }
  if (!input.phone) return null;
  const { contact } = await upsertContactByPhone(
    client,
    workspaceId,
    { email: input.email, fullName: input.fullName ?? null, phone: input.phone, source: "stripe" },
    STRIPE_ACTOR,
  );
  return contact.id;
}

export async function syncAgencyContact(
  client: CrmClient,
  input: AgencyContactInput,
  env: Record<string, string | undefined> = process.env,
): Promise<AgencyContactResult> {
  const { data: agency, error } = await client
    .from("workspaces")
    .select("id")
    .eq("company_code", agencyWorkspaceCode(env))
    .maybeSingle();
  if (error) throw new Error(`agency workspace: ${error.message}`);
  if (!agency) return { ok: false, reason: "no_agency_workspace" };
  const agencyId = (agency as { id: string }).id;

  const contactId = await findContactId(client, agencyId, input);
  if (!contactId) return { ok: false, reason: "no_contact_without_phone" };

  const kind = bucket(input.status);
  if (kind) {
    const add = await ensureTag(client, agencyId, LEVY_TAGS[kind]);
    await addTagToContact(client, agencyId, contactId, add.id, STRIPE_ACTOR);
    // Al pagar se quitan impago y cancelado; al cancelar, el impago.
    const remove = kind === "active" ? [LEVY_TAGS.pastDue, LEVY_TAGS.canceled] : kind === "canceled" ? [LEVY_TAGS.pastDue] : [];
    for (const tag of await findTagsByNames(client, agencyId, remove)) {
      await removeTagFromContact(client, agencyId, contactId, tag.id, STRIPE_ACTOR);
    }
    const stageName = kind === "active" ? STAGES.active : kind === "canceled" ? STAGES.canceled : null;
    const stage = stageName ? await findStageByName(client, agencyId, stageName) : null;
    if (stage) await setContactStage(client, agencyId, contactId, stage.id, STRIPE_ACTOR);
  }

  const keys = await ensureFields(client, agencyId);
  const values: Record<string, unknown> = {
    levy_company_code: input.companyCode ?? null,
    levy_plan: input.plan ?? null,
    levy_workspace_id: input.workspaceId,
  };
  const customFields = Object.fromEntries(Object.entries(values).filter(([key, value]) => keys.has(key) && value));
  if (Object.keys(customFields).length > 0) {
    await updateContact(client, agencyId, contactId, { customFields }, STRIPE_ACTOR);
  }

  return { contactId, ok: true };
}
