import nodemailer from "nodemailer";

/**
 * Correo transaccional de la plataforma Levy: el acceso tras pagar y los avisos
 * de la reunión de puesta en marcha. Sale por SMTP de un solo buzón de Levy,
 * configurado en el servidor; no es de ninguna empresa. La contraseña no se
 * registra nunca; los errores dicen el código, no el contenido.
 */

const SENDER_NAME = "Levy";
const DEFAULT_SMTP_PORT = 465;
const CONNECT_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

export type EmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export type SmtpConfig = { host: string; pass: string; port: number; user: string };
export type OutgoingEmail = EmailMessage & { from: { address: string; name: string } };
export type EmailTransport = (mail: OutgoingEmail, smtp: SmtpConfig) => Promise<{ messageId?: string }>;

export type EmailDeps = {
  env?: Record<string, string | undefined>;
  transport?: EmailTransport;
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

function smtpConfig(env: Record<string, string | undefined>): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const port = Number.parseInt(env.SMTP_PORT ?? "", 10);

  return host && user && pass ? { host, pass, port: Number.isInteger(port) && port > 0 ? port : DEFAULT_SMTP_PORT, user } : null;
}

export function isEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return smtpConfig(env) !== null;
}

const sendWithSmtp: EmailTransport = (mail, { host, pass, port, user }) =>
  nodemailer
    .createTransport({
      auth: { pass, user },
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: CONNECT_TIMEOUT_MS,
      host,
      port,
      requireTLS: port !== 465,
      secure: port === 465,
      socketTimeout: SOCKET_TIMEOUT_MS,
    })
    .sendMail(mail);

function failureMessage(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;

  return code === "EAUTH"
    ? "El servidor de correo rechazó SMTP_USER o SMTP_PASSWORD."
    : `El servidor de correo no pudo enviar el mensaje (${typeof code === "string" ? code : "error"}).`;
}

export async function sendEmail(message: EmailMessage, deps: EmailDeps = {}) {
  const smtp = smtpConfig(deps.env ?? process.env);

  if (!smtp) {
    throw new EmailError("not_configured", "Faltan SMTP_HOST, SMTP_USER o SMTP_PASSWORD: el correo no está configurado.");
  }
  const to = message.to.trim().toLowerCase();
  if (!isValidEmailAddress(to)) {
    throw new EmailError("invalid", "El correo del destinatario no es válido.");
  }

  try {
    const sent = await (deps.transport ?? sendWithSmtp)(
      { ...message, from: { address: smtp.user, name: SENDER_NAME }, to },
      smtp,
    );
    return { id: sent.messageId ?? null };
  } catch (error) {
    throw new EmailError("failed", failureMessage(error));
  }
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
