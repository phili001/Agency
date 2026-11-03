import type { CrmClient } from "./crm/shared.ts";
import { agencyWorkspaceCode } from "./billing/agency-crm.ts";
import { getGmailStatus, isValidEmailAddress, sendGmail } from "./integrations/gmail.ts";

/**
 * Correo del sistema de Levy (acceso tras pagar, reenvío desde `/bienvenida`).
 * `sendSystemEmail` elige remitente: el Gmail conectado de AAA001 y, de
 * respaldo, Resend por `fetch` a su API REST (sin librería). Las claves no se
 * registran nunca; los errores dicen el código HTTP, no el cuerpo enviado.
 *
 * Lo que una empresa manda a sus contactos no pasa por aquí: va siempre por su
 * propio Gmail (`crm/contact-email.ts`).
 */

const RESEND_URL = "https://api.resend.com/emails";

export type EmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export type EmailDeps = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => Date;
};

export class EmailError extends Error {
  readonly code: "failed" | "invalid" | "not_configured";

  constructor(code: EmailError["code"], message: string) {
    super(message);
    this.name = "EmailError";
    this.code = code;
  }
}

export function isEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function sendViaResend(message: EmailMessage, deps: EmailDeps = {}) {
  const env = deps.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new EmailError("not_configured", "Faltan RESEND_API_KEY o EMAIL_FROM: el correo no está configurado.");
  }
  const to = message.to.trim().toLowerCase();
  if (!isValidEmailAddress(to)) {
    throw new EmailError("invalid", "El correo del destinatario no es válido.");
  }

  const response = await (deps.fetch ?? fetch)(RESEND_URL, {
    body: JSON.stringify({ from, html: message.html, subject: message.subject, text: message.text, to: [to] }),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new EmailError("failed", `Resend respondió ${response.status}.`);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: unknown };
  return { id: typeof data.id === "string" ? data.id : null };
}

/** Gmail de AAA001 si está conectado; si no o si falla, Resend si existe `RESEND_API_KEY`. */
export async function sendSystemEmail(client: CrmClient, message: EmailMessage, deps: EmailDeps = {}) {
  const env = deps.env ?? process.env;
  let gmailProblem: string | null = null;

  try {
    const { data: agency, error } = await client
      .from("workspaces")
      .select("id")
      .eq("company_code", agencyWorkspaceCode(env))
      .maybeSingle();
    if (error) throw new Error(error.message);
    const agencyId = (agency as { id: string } | null)?.id;

    if (agencyId && (await getGmailStatus(client, agencyId, env)).connected) {
      const sent = await sendGmail(client, agencyId, message, deps, { fromName: "Levy" });
      return { id: sent.id, via: "gmail" as const };
    }
  } catch (error) {
    gmailProblem = error instanceof Error ? error.message : "error";
    console.error(`[email] Gmail de Levy no disponible: ${gmailProblem}`);
  }

  if (env.RESEND_API_KEY?.trim()) {
    const sent = await sendViaResend(message, deps);
    return { id: sent.id, via: "resend" as const };
  }

  throw gmailProblem
    ? new EmailError("failed", `No se pudo enviar por Gmail y no hay Resend de respaldo: ${gmailProblem}`)
    : new EmailError("not_configured", "No hay correo configurado: conecta el Gmail de la empresa de Levy o define RESEND_API_KEY y EMAIL_FROM.");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Correo de acceso tras pagar: enlace de primer acceso para poner la contraseña. */
export function buildWelcomeEmail({ companyName, link, to }: { companyName: string; link: string; to: string }): EmailMessage {
  const name = companyName.trim() || "tu empresa";

  return {
    html: [
      `<p>¡Hola!</p>`,
      `<p>Ya está lista la cuenta de <strong>${escapeHtml(name)}</strong> en Levy.</p>`,
      `<p><a href="${escapeHtml(link)}">Entra y elige tu contraseña</a></p>`,
      `<p>El enlace es personal y caduca en unas horas. Si caduca, pide otro desde «¿Olvidaste tu contraseña?».</p>`,
    ].join("\n"),
    subject: `Tu cuenta de Levy para ${name}`,
    text: [
      "¡Hola!",
      `Ya está lista la cuenta de ${name} en Levy.`,
      `Entra y elige tu contraseña: ${link}`,
      "El enlace es personal y caduca en unas horas. Si caduca, pide otro desde «¿Olvidaste tu contraseña?».",
    ].join("\n\n"),
    to,
  };
}

/** Texto plano del operador o de un flujo → HTML seguro (sin marcado, con sus saltos de línea). */
export function plainTextToHtml(value: string) {
  return `<div>${escapeHtml(value).replaceAll(/\r?\n/g, "<br>")}</div>`;
}
