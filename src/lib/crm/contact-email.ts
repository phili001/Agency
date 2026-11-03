import { isWorkspaceBlockedOrNot } from "../billing/gate.ts";
import { plainTextToHtml } from "../email.ts";
import type { GoogleDeps } from "../integrations/google-calendar.ts";
import { sendGmail } from "../integrations/gmail.ts";
import { logActivity } from "./activity.ts";
import { conflict, dbFailure, invalid, notFound } from "./errors.ts";
import type { CrmActor, CrmClient } from "./shared.ts";

/**
 * Correo de una empresa a un contacto suyo, desde la ficha o desde un flujo.
 * Sale siempre del Gmail de esa empresa (nunca del de otra ni de Resend),
 * respeta el bloqueo por impago y deja rastro en la actividad del contacto.
 */

const MAX_SUBJECT = 200;
const MAX_BODY = 20_000;

export type ContactEmailDeps = { google?: GoogleDeps };

type EmailContact = { company: string | null; email: string | null; full_name: string | null; phone_e164: string | null };

async function readContact(client: CrmClient, workspaceId: string, contactId: string) {
  const { data, error } = await client
    .from("contacts")
    .select("email, full_name, company, phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw dbFailure("contactEmail.contact", error);
  if (!data) throw notFound("Ese contacto no existe en esta empresa.");

  return data as EmailContact;
}

/** Variables que un flujo puede usar en el asunto y el cuerpo. */
export async function contactEmailVariables(client: CrmClient, workspaceId: string, contactId: string) {
  const contact = await readContact(client, workspaceId, contactId);

  return {
    email: contact.email ?? "",
    empresa: contact.company ?? "",
    nombre: contact.full_name ?? "",
    telefono: contact.phone_e164 ?? "",
  };
}

export async function sendContactEmail(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
  input: { body?: unknown; subject?: unknown },
  actor: CrmActor,
  deps: ContactEmailDeps = {},
) {
  const subject = typeof input.subject === "string" ? input.subject.replace(/\s+/g, " ").trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";

  if (!subject || subject.length > MAX_SUBJECT) {
    throw invalid(`El asunto es obligatorio (máximo ${MAX_SUBJECT} caracteres).`);
  }
  if (!body || body.length > MAX_BODY) {
    throw invalid(`El texto del correo es obligatorio (máximo ${MAX_BODY} caracteres).`);
  }

  const contact = await readContact(client, workspaceId, contactId);

  if (!contact.email) {
    throw invalid("Este contacto no tiene correo.");
  }
  if (await isWorkspaceBlockedOrNot(client, workspaceId)) {
    throw conflict("La suscripción de esta empresa está sin pagar: reactívala para enviar correos.");
  }

  const { data: workspace, error: workspaceError } = await client.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  if (workspaceError) throw dbFailure("contactEmail.workspace", workspaceError);

  // Si apuntar la actividad falla, el correo ya salió: no se da por fallido.
  const record = (kind: "email_failed" | "email_sent", data: Record<string, string | null>) =>
    logActivity(client, workspaceId, contactId, kind, data, actor).catch((error: unknown) => {
      console.error("[contact-email] actividad no guardada:", error instanceof Error ? error.message : error);
    });

  try {
    const sent = await sendGmail(
      client,
      workspaceId,
      { html: plainTextToHtml(body), subject, text: body, to: contact.email },
      deps.google,
      { fromName: (workspace as { name: string } | null)?.name },
    );
    await record("email_sent", { from: sent.from, gmail_message_id: sent.id, subject, to: contact.email });

    return { from: sent.from, id: sent.id, to: contact.email };
  } catch (error) {
    await record("email_failed", { error: error instanceof Error ? error.message.slice(0, 300) : "error", subject, to: contact.email });
    throw error;
  }
}
