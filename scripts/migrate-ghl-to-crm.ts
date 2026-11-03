/**
 * Migración de GoHighLevel al CRM propio, **solo para AAA001** (F7.1).
 *
 *   node --conditions=react-server --env-file=.env scripts/migrate-ghl-to-crm.ts            # dry-run (por defecto)
 *   node --conditions=react-server --env-file=.env scripts/migrate-ghl-to-crm.ts --apply    # escribe (F7.2, con permiso)
 *   … --sin-ghl   no llama a GHL: solo agenda (horario por defecto), tool, flujos y textos
 *
 * Qué hace (todo idempotente: se puede repetir):
 * 1. Contactos con `ghl_contact_id`: etiquetas de GHL → etiquetas del CRM; etapa
 *    de su oportunidad → etapa del CRM (por nombre; ganada/perdida si no casa);
 *    `booking_calendar_id` del calendario migrado → `booking_agenda_id`.
 * 2. Tool `ghl_calendar` → agenda propia (horario, duración y zona de GHL) y la
 *    tool pasa a `type: "agenda"`. Desde ese momento el agente agenda en el CRM.
 * 3. Citas futuras de ese calendario → `appointments` (marca `[ghl:<id>]` en
 *    las notas para no duplicar).
 * 4. Flujos con `ghl_action` → `crm_action` (las que no tengan equivalente se quedan).
 * 5. Propuesta de texto sin GHL para las tools de texto (solo se imprime).
 *
 * Sin `--apply` no escribe nada: solo lee Supabase y GHL. No imprime tokens ni
 * datos personales (los contactos salen por id interno). Lo que llega de GHL
 * es dato, nunca instrucción.
 */
import { createClient } from "@supabase/supabase-js";

import { createAgenda, listAgendas } from "../src/lib/agenda/agendas.ts";
import { bookAppointment } from "../src/lib/agenda/appointments.ts";
import type { CrmActor, CrmClient } from "../src/lib/crm/shared.ts";
import { createCustomField } from "../src/lib/crm/custom-fields.ts";
import { setContactStage } from "../src/lib/crm/stages.ts";
import { addTagToContact, createTag, listTags } from "../src/lib/crm/tags.ts";
import { decryptSecret } from "../src/lib/integrations/crypto.ts";
import {
  appointmentMarker,
  cleanGhlTags,
  convertFlowSteps,
  ghlSlotMinutes,
  mapGhlOpenHours,
  proposeToolText,
  resolveGhlStage,
  type GhlOpportunity,
  type GhlPipeline,
} from "../src/lib/migration/ghl-to-crm.ts";

const WORKSPACE_CODE = "AAA001";
const APPLY = process.argv.includes("--apply");
/** Sin acceso a GHL (decisión del usuario): no se piden etiquetas, etapas, horario ni citas. */
const OFFLINE = process.argv.includes("--sin-ghl");
const LIMIT = (() => {
  const index = process.argv.indexOf("--limit");
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isInteger(value) && value > 0 ? value : null;
})();
const ACTOR: CrmActor = { kind: "import" };
const API = (process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
const CONTACTS_VERSION = "2021-07-28";
const CALENDAR_VERSION = "2021-04-15";
const THROTTLE_MS = 150;

function requireEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`Falta ${key} (usa --env-file=.env).`);
    process.exit(2);
  }
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GhlContext = { apiKey: string; locationId: string };

async function ghl<T>(ctx: GhlContext, path: string, query: Record<string, string>, version: string): Promise<T> {
  if (OFFLINE) {
    const error = new Error(`GHL ${path} → no se consulta (--sin-ghl)`) as Error & { status?: number };
    error.status = 0;
    throw error;
  }
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(THROTTLE_MS);
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${ctx.apiKey}`, Version: version },
    });
    if (response.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as T & { message?: unknown };
    if (!response.ok) {
      const error = new Error(`GHL ${path} → HTTP ${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  throw new Error(`GHL ${path} → demasiadas peticiones`);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function main() {
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = supabase as unknown as CrmClient;
  requireEnv("INTEGRATION_ENCRYPTION_KEY");

  const report = {
    agenda: {} as Record<string, unknown>,
    appointments: { alreadyImported: 0, skippedCancelled: 0, toImport: 0, unmatchedContact: 0 },
    contacts: {
      ghlNotFound: 0,
      ghlErrors: 0,
      pinnedCalendarToAgenda: 0,
      processed: 0,
      stageChanges: {} as Record<string, number>,
      stageUnmapped: {} as Record<string, number>,
      tagAssignments: 0,
      withoutChanges: 0,
    },
    flows: [] as Array<Record<string, unknown>>,
    mode: `${APPLY ? "apply" : "dry-run"}${OFFLINE ? " sin GHL" : ""}`,
    newTags: [] as string[],
    toolProposals: [] as Array<Record<string, unknown>>,
    warnings: [] as string[],
  };
  const warn = (message: string) => {
    if (!report.warnings.includes(message)) report.warnings.push(message);
  };
  const statusOf = (error: unknown) => (error as { status?: number }).status;

  // --- Empresa, conexión de GHL y token -----------------------------------------------
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, company_code")
    .eq("company_code", WORKSPACE_CODE)
    .single();
  if (workspaceError || !workspace) throw new Error(`No se encontró ${WORKSPACE_CODE}.`);
  const workspaceId = workspace.id as string;

  const [{ data: integration }, { data: secret }] = await Promise.all([
    supabase.from("integrations").select("config, status").eq("workspace_id", workspaceId).eq("provider", "gohighlevel").maybeSingle(),
    supabase.from("integration_secrets").select("ciphertext").eq("workspace_id", workspaceId).eq("provider", "gohighlevel").eq("kind", "api_key").maybeSingle(),
  ]);
  const config = asRecord(integration?.config);
  const locationId = typeof config.location_id === "string" ? config.location_id : "";
  const defaultPipelineId = typeof config.default_pipeline_id === "string" ? config.default_pipeline_id : null;
  if (!OFFLINE && (!locationId || !secret?.ciphertext)) throw new Error("AAA001 no tiene una conexión de GHL con location y token.");
  const ctx: GhlContext = { apiKey: OFFLINE ? "" : decryptSecret(secret?.ciphertext as string), locationId };

  // --- Etapas y etiquetas actuales del CRM ------------------------------------------------
  const { data: stageRows } = await supabase.from("crm_pipeline_stages").select("id, name, kind").eq("workspace_id", workspaceId);
  const crmStages = (stageRows ?? []) as Array<{ id: string; kind: string; name: string }>;
  const stageName = new Map(crmStages.map((stage) => [stage.id, stage.name]));
  const tagByName = new Map((await listTags(client, workspaceId)).map((tag) => [tag.name.toLowerCase(), tag]));

  let pipelines: GhlPipeline[] = [];
  let opportunitiesAllowed = true;
  try {
    pipelines = (await ghl<{ pipelines?: GhlPipeline[] }>(ctx, "/opportunities/pipelines", { locationId }, CONTACTS_VERSION)).pipelines ?? [];
  } catch (error) {
    opportunitiesAllowed = false;
    warn(`Pipelines de GHL: HTTP ${statusOf(error) ?? "?"} (¿el token no tiene permiso de oportunidades?). Las etapas no se migran.`);
  }
  const stageToCrm = new Map<string, { id: string; name: string }>();
  for (const stage of pipelines.flatMap((pipeline) => pipeline.stages ?? [])) {
    const match = resolveGhlStage([{ pipelineStageId: stage.id }], pipelines, crmStages, null).stageId;
    if (match) stageToCrm.set(stage.id, { id: match, name: stageName.get(match) ?? "" });
  }

  // --- 2. Calendario de GHL → agenda ------------------------------------------------------
  const { data: assets } = await supabase
    .from("workspace_assets")
    .select("id, title, content, kind, status, metadata")
    .eq("workspace_id", workspaceId)
    .eq("kind", "tool");
  const calendarTools = (assets ?? []).filter((asset) => asRecord(asset.metadata).type === "ghl_calendar");
  const calendarToAgenda = new Map<string, string>();
  const migratedCalendars: Array<{ agendaId: string | null; calendarId: string; name: string; toolId: string; toolMetadata: Record<string, unknown> }> = [];
  const existingAgendas = await listAgendas(client, workspaceId);

  for (const tool of calendarTools) {
    const metadata = asRecord(tool.metadata);
    const calendarId = String(metadata.calendar_id ?? "");
    const name = String(metadata.calendar_name || tool.title).slice(0, 80);
    let calendar: Record<string, unknown> = {};
    let location: Record<string, unknown> = {};
    try {
      calendar = asRecord((await ghl<{ calendar?: unknown }>(ctx, `/calendars/${encodeURIComponent(calendarId)}`, {}, CALENDAR_VERSION)).calendar);
    } catch (error) {
      warn(`Calendario de GHL «${name}»: HTTP ${statusOf(error) ?? "?"}. Se usaría el horario por defecto.`);
    }
    try {
      location = asRecord((await ghl<{ location?: unknown }>(ctx, `/locations/${encodeURIComponent(locationId)}`, {}, CONTACTS_VERSION)).location);
    } catch (error) {
      warn(`Location de GHL: HTTP ${statusOf(error) ?? "?"}. Zona horaria por defecto Europe/Madrid.`);
    }
    const schedule = mapGhlOpenHours(calendar.openHours);
    const duration = ghlSlotMinutes(calendar.slotDuration, calendar.slotDurationUnit);
    const step = ghlSlotMinutes(calendar.slotInterval, calendar.slotIntervalUnit, duration);
    const timezone = typeof location.timezone === "string" && location.timezone ? location.timezone : "Europe/Madrid";
    const existing = existingAgendas.find((agenda) => agenda.name.toLowerCase() === name.toLowerCase());

    report.agenda[name] = {
      existing: Boolean(existing),
      schedule: schedule ?? "(GHL no trae horario: se usará L-V 9-18; revisar)",
      serviceMinutes: duration,
      slotStepMinutes: Math.min(Math.max(step, 5), 240),
      timezone,
    };

    let agendaId = existing?.id ?? null;
    if (APPLY && !agendaId) {
      agendaId = (
        await createAgenda(client, workspaceId, {
          description: typeof tool.content === "string" ? tool.content : "",
          name,
          ...(schedule ? { schedule } : {}),
          services: [{ duration_minutes: duration, name }],
          slotStepMinutes: Math.min(Math.max(step, 5), 240),
          timezone,
        })
      ).id;
    }
    calendarToAgenda.set(calendarId, agendaId ?? "(agenda nueva)");
    migratedCalendars.push({ agendaId, calendarId, name, toolId: tool.id as string, toolMetadata: metadata });
  }

  // --- 1. Contactos -------------------------------------------------------------------------
  let contactQuery = supabase
    .from("contacts")
    .select("id, stage_id, metadata")
    .eq("workspace_id", workspaceId)
    .not("metadata->>ghl_contact_id", "is", null)
    .order("created_at", { ascending: true });
  if (LIMIT) contactQuery = contactQuery.limit(LIMIT);
  const { data: contacts, error: contactsError } = await contactQuery;
  if (contactsError) throw new Error(contactsError.message);

  const { data: tagLinks } = await supabase.from("crm_contact_tags").select("contact_id, tag_id").eq("workspace_id", workspaceId);
  const tagNameById = new Map([...tagByName.values()].map((tag) => [tag.id, tag.name.toLowerCase()]));
  const currentTags = new Map<string, Set<string>>();
  for (const link of tagLinks ?? []) {
    const set = currentTags.get(link.contact_id as string) ?? new Set<string>();
    const name = tagNameById.get(link.tag_id as string);
    if (name) set.add(name);
    currentTags.set(link.contact_id as string, set);
  }
  const contactByGhlId = new Map<string, string>();
  const newTagNames = new Set<string>();

  if (OFFLINE) warn("Sin GHL: etiquetas, etapas y citas de GHL no se migran.");
  for (const contact of OFFLINE ? [] : (contacts ?? [])) {
    const metadata = asRecord(contact.metadata);
    const ghlId = String(metadata.ghl_contact_id);
    contactByGhlId.set(ghlId, contact.id as string);
    report.contacts.processed += 1;

    let tags: string[] = [];
    let opportunities: GhlOpportunity[] = [];
    try {
      const detail = await ghl<{ contact?: { tags?: unknown } }>(ctx, `/contacts/${encodeURIComponent(ghlId)}`, {}, CONTACTS_VERSION);
      tags = cleanGhlTags(detail.contact?.tags);
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 400) report.contacts.ghlNotFound += 1;
      else {
        report.contacts.ghlErrors += 1;
        warn(`Contactos de GHL: HTTP ${status ?? "?"}.`);
        // Token rechazado: no tiene sentido seguir pidiendo los demás.
        if (status === 401 || status === 403) break;
      }
      continue;
    }
    if (opportunitiesAllowed) {
      try {
        opportunities =
          (await ghl<{ opportunities?: GhlOpportunity[] }>(ctx, "/opportunities/search", { contact_id: ghlId, location_id: locationId }, CONTACTS_VERSION))
            .opportunities ?? [];
      } catch (error) {
        opportunitiesAllowed = false;
        warn(`Oportunidades de GHL: HTTP ${statusOf(error) ?? "?"}. Las etapas no se migran.`);
      }
    }

    const have = currentTags.get(contact.id as string) ?? new Set<string>();
    const addTags = tags.filter((tag) => !have.has(tag));
    const { ghlStageName, stageId } = resolveGhlStage(opportunities, pipelines, crmStages, defaultPipelineId);
    const stageChange = stageId && stageId !== contact.stage_id ? stageId : null;
    if (ghlStageName && !stageId) report.contacts.stageUnmapped[ghlStageName] = (report.contacts.stageUnmapped[ghlStageName] ?? 0) + 1;
    const pinned = typeof metadata.booking_calendar_id === "string" ? calendarToAgenda.get(metadata.booking_calendar_id) : undefined;
    const pinChange = pinned && metadata.booking_agenda_id !== pinned;

    if (addTags.length === 0 && !stageChange && !pinChange) {
      report.contacts.withoutChanges += 1;
      continue;
    }
    report.contacts.tagAssignments += addTags.length;
    for (const tag of addTags) if (!tagByName.has(tag)) newTagNames.add(tag);
    if (stageChange) {
      const label = stageName.get(stageChange) ?? stageChange;
      report.contacts.stageChanges[label] = (report.contacts.stageChanges[label] ?? 0) + 1;
    }
    if (pinChange) report.contacts.pinnedCalendarToAgenda += 1;

    if (APPLY) {
      for (const name of addTags) {
        let tag = tagByName.get(name);
        if (!tag) {
          tag = await createTag(client, workspaceId, { name });
          tagByName.set(name, tag);
        }
        await addTagToContact(client, workspaceId, contact.id as string, tag.id, ACTOR);
      }
      if (stageChange) await setContactStage(client, workspaceId, contact.id as string, stageChange, ACTOR);
      if (pinChange && pinned && !pinned.startsWith("(")) {
        await supabase
          .from("contacts")
          .update({ metadata: { ...metadata, booking_agenda_id: pinned } })
          .eq("workspace_id", workspaceId)
          .eq("id", contact.id as string);
      }
    }
  }
  report.newTags = [...newTagNames].sort();

  // --- 3. Citas futuras -------------------------------------------------------------------
  for (const calendar of migratedCalendars) {
    const now = Date.now();
    let events: Array<Record<string, unknown>> = [];
    try {
      events =
        (
          await ghl<{ events?: Array<Record<string, unknown>> }>(
            ctx,
            "/calendars/events",
            { calendarId: calendar.calendarId, endTime: String(now + 365 * 24 * 60 * 60 * 1000), locationId, startTime: String(now) },
            CALENDAR_VERSION,
          )
        ).events ?? [];
    } catch (error) {
      if (!OFFLINE) warn(`Citas de GHL «${calendar.name}»: HTTP ${statusOf(error) ?? "?"}. No se importan citas.`);
    }

    const { data: imported } = calendar.agendaId
      ? await supabase.from("appointments").select("notes").eq("workspace_id", workspaceId).eq("agenda_id", calendar.agendaId).ilike("notes", "%[ghl:%")
      : { data: [] as Array<{ notes: string | null }> };
    const importedNotes = (imported ?? []).map((row) => String(row.notes ?? ""));

    for (const event of events) {
      const status = String(event.appointmentStatus ?? event.status ?? "").toLowerCase();
      if (status === "cancelled" || status === "invalid" || status === "noshow") {
        report.appointments.skippedCancelled += 1;
        continue;
      }
      const eventId = String(event.id ?? "");
      if (importedNotes.some((notes) => notes.includes(appointmentMarker(eventId)))) {
        report.appointments.alreadyImported += 1;
        continue;
      }
      const contactId = contactByGhlId.get(String(event.contactId ?? ""));
      if (!contactId) {
        report.appointments.unmatchedContact += 1;
        continue;
      }
      report.appointments.toImport += 1;
      if (APPLY && calendar.agendaId) {
        await bookAppointment(
          client,
          workspaceId,
          {
            agendaId: calendar.agendaId,
            contactId,
            notes: `Importada de GoHighLevel ${appointmentMarker(eventId)}`,
            service: calendar.name,
            startsAt: String(event.startTime),
          },
          ACTOR,
        );
      }
    }

    // La tool pasa a la agenda propia (el agente deja de usar GHL).
    if (APPLY && calendar.agendaId) {
      await supabase
        .from("workspace_assets")
        .update({
          metadata: { agenda_id: calendar.agendaId, agenda_name: calendar.name, is_default: calendar.toolMetadata.is_default === true, type: "agenda" },
        })
        .eq("workspace_id", workspaceId)
        .eq("id", calendar.toolId);
    }
  }

  // --- 4. Flujos ---------------------------------------------------------------------------
  const { data: flows } = await supabase.from("flows").select("id, name, status, steps").eq("workspace_id", workspaceId);
  for (const flow of flows ?? []) {
    const result = convertFlowSteps(flow.steps, { calendarToAgenda, stageToCrm });
    if (result.converted === 0 && result.unconverted.length === 0) continue;
    const { data: fieldRows } = await supabase.from("crm_custom_fields").select("key").eq("workspace_id", workspaceId);
    const existingKeys = new Set((fieldRows ?? []).map((row) => row.key as string));
    const missingFields = result.fieldKeys.filter((key) => !existingKeys.has(key));
    report.flows.push({ converted: result.converted, fieldsToCreate: missingFields, id: flow.id, name: flow.name, status: flow.status, unconverted: result.unconverted });
    if (APPLY) {
      for (const key of missingFields) {
        // Campo de texto con el nombre legible de la clave; la IA no lo lee hasta que se marque.
        const label = key.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()).slice(0, 80);
        await createCustomField(client, workspaceId, { ai_readable: false, key, label, type: "text" });
      }
    }
    if (APPLY && result.converted > 0 && ![...calendarToAgenda.values()].some((id) => id.startsWith("("))) {
      await supabase.from("flows").update({ steps: result.steps }).eq("workspace_id", workspaceId).eq("id", flow.id as string);
    }
  }

  // --- 5. Tools de texto ---------------------------------------------------------------------
  for (const asset of assets ?? []) {
    const text = `${asset.title}\n${asset.content ?? ""}`;
    if (asRecord(asset.metadata).type || !/go\s?high\s?level|\bghl\b|disponibilidad/i.test(text)) continue;
    const proposal = proposeToolText(String(asset.title), String(asset.content ?? ""));
    report.toolProposals.push({ id: asset.id, proposedContent: proposal.content, proposedTitle: proposal.title, title: asset.title });
    if (APPLY && (proposal.title !== asset.title || proposal.content !== (asset.content ?? ""))) {
      await supabase
        .from("workspace_assets")
        .update({ content: proposal.content, title: proposal.title })
        .eq("workspace_id", workspaceId)
        .eq("id", asset.id as string);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!APPLY) console.log("\nDry-run: no se ha escrito nada. Para aplicar (F7.2) añade --apply.");
}

main().catch((error) => {
  console.error("La migración se detuvo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
