/**
 * Correo transaccional con Resend, por `fetch` a su API REST (sin librería).
 * Se usa para el correo de acceso tras pagar Levy y los avisos de la reunión de
 * puesta en marcha. La clave no se registra nunca; los errores dicen el código HTTP, no el cuerpo enviado.
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
};

export class EmailError extends Error {
  readonly code: "failed" | "invalid" | "not_configured";

  constructor(code: EmailError["code"], message: string) {
    super(message);
    this.name = "EmailError";
    this.code = code;
  }
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmailAddress(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function isEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: EmailMessage, deps: EmailDeps = {}) {
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
