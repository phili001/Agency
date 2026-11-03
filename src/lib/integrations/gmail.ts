import "server-only";

import { randomBytes } from "node:crypto";

import type { CrmClient } from "../crm/shared.ts";
import {
  type GoogleDeps,
  type GoogleTokens,
  GoogleCalendarError,
  buildAuthUrl,
  createOAuthState,
  disconnect,
  exchangeCode,
  getAccessToken,
  getGoogleOAuthConfig,
  markReconnectRequired,
  readTokens,
  saveTokens,
  setIntegration,
} from "./google-calendar.ts";

/**
 * Enviar correo con la cuenta de Google de cada empresa, por `fetch` a la API
 * de Gmail. Es una conexión aparte de Calendar: pide solo su scope (autorización
 * incremental), guarda sus propios tokens cifrados (provider `gmail`) y usa el
 * mismo manejo de errores: renovación sola y, si Google retira el acceso, la
 * integración pasa a `error` con el motivo para el panel.
 *
 * `gmail.send` no deja leer el perfil de la cuenta, por eso se piden también
 * `openid` y `email`: así se sabe desde qué dirección se envía.
 */

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_SCOPES = [GMAIL_SEND_SCOPE, "openid", "email"];

const PROVIDER = "gmail";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const NOT_GRANTED =
  "Google no ha concedido el permiso para enviar correo. Vuelve a conectar el correo y marca la casilla de enviar.";

export type GmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

const EMAIL_PATTERN = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[^\s@<>"(),;:]+$/;

export function isValidEmailAddress(value: string) {
  return EMAIL_PATTERN.test(value);
}

// --- Mensaje MIME ---------------------------------------------------------------------

/** Quita saltos de línea: lo que venga de un contacto no puede añadir cabeceras. */
function headerValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Cabecera con UTF-8 (RFC 2047), en trozos que no parten ningún carácter. */
export function encodeHeaderText(value: string, plainPattern = /^[\x20-\x7e]*$/) {
  const clean = headerValue(value);

  if (plainPattern.test(clean)) {
    return clean;
  }

  const chunks: string[] = [];
  let current = "";

  for (const character of clean) {
    if (Buffer.byteLength(current + character) > 45) {
      chunks.push(current);
      current = "";
    }
    current += character;
  }
  chunks.push(current);

  return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`).join("\r\n ");
}

function bodyPart(contentType: string, content: string) {
  const encoded = Buffer.from(content).toString("base64").replace(/(.{76})/g, "$1\r\n");

  return [`Content-Type: ${contentType}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", encoded].join("\r\n");
}

/** Mensaje completo en base64url, que es lo que pide `messages.send`. */
export function buildRawMessage(message: GmailMessage, from?: { email: string | null; name?: string }) {
  const boundary = `levy_${randomBytes(12).toString("hex")}`;
  const fromHeader = from?.email
    ? from.name
      ? // Un nombre con comas o comillas partiría la dirección: solo va tal cual si es simple.
        `From: ${encodeHeaderText(from.name, /^[A-Za-z0-9 ]*$/)} <${headerValue(from.email)}>`
      : `From: ${headerValue(from.email)}`
    : null;
  const lines = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${headerValue(message.to)}`,
    `Subject: ${encodeHeaderText(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    bodyPart("text/plain", message.text),
    `--${boundary}`,
    bodyPart("text/html", message.html),
    `--${boundary}--`,
    "",
  ];

  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// --- Conexión -------------------------------------------------------------------------

export function gmailConnectUrl({ userId, workspaceId }: { userId: string; workspaceId: string }, deps: GoogleDeps = {}) {
  return buildAuthUrl(createOAuthState({ purpose: "gmail", userId, workspaceId }, deps), deps, GMAIL_SCOPES);
}

export function exchangeGmailCode(code: string, deps: GoogleDeps = {}) {
  return exchangeCode(code, deps, { missingMessage: NOT_GRANTED, provider: PROVIDER, requiredScopes: [GMAIL_SEND_SCOPE] });
}

export async function saveGmailConnection(client: CrmClient, workspaceId: string, tokens: GoogleTokens, deps: GoogleDeps = {}) {
  await saveTokens(client, workspaceId, tokens, PROVIDER);

  let accountEmail: string | null = null;
  try {
    const response = await (deps.fetch ?? globalThis.fetch)(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const profile = response.ok ? ((await response.json()) as { email?: unknown }) : null;
    accountEmail = typeof profile?.email === "string" ? profile.email : null;
  } catch {
    // Sin la dirección también se puede enviar: Gmail pone la de la cuenta.
    accountEmail = null;
  }

  await setIntegration(
    client,
    workspaceId,
    {
      config: {
        account_email: accountEmail,
        connected_at: (deps.now ?? (() => new Date()))().toISOString(),
        scopes: tokens.scope.split(/\s+/).filter(Boolean),
      },
      last_error: null,
      status: "active",
    },
    PROVIDER,
  );

  return { accountEmail };
}

export async function getGmailStatus(client: CrmClient, workspaceId: string, env: Record<string, string | undefined> = process.env) {
  const { data, error } = await client
    .from("integrations")
    .select("status, config, last_error")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(`[gmail:status] ${error.message}`);
  }

  const row = data as { config: Record<string, unknown> | null; last_error: string | null; status: string } | null;
  const scopes = Array.isArray(row?.config?.scopes) ? (row.config.scopes as string[]) : [];

  return {
    accountEmail: typeof row?.config?.account_email === "string" ? row.config.account_email : null,
    canSend: row?.status === "active" && scopes.includes(GMAIL_SEND_SCOPE),
    configured: getGoogleOAuthConfig(env) !== null,
    connected: row?.status === "active",
    lastError: row?.last_error ?? null,
    status: (row?.status ?? "disconnected") as "active" | "disabled" | "disconnected" | "error" | "pending",
  };
}

export function disconnectGmail(client: CrmClient, workspaceId: string, deps: GoogleDeps = {}) {
  return disconnect(client, workspaceId, deps, PROVIDER);
}

// --- Envío ----------------------------------------------------------------------------

/**
 * Envía con el Gmail de ESA empresa: los tokens se leen siempre por
 * `workspaceId`, y sin conexión falla en vez de usar la de otra.
 */
export async function sendGmail(
  client: CrmClient,
  workspaceId: string,
  message: GmailMessage,
  deps: GoogleDeps = {},
  { fromName }: { fromName?: string } = {},
) {
  const status = await getGmailStatus(client, workspaceId, deps.env ?? process.env);

  if (status.status === "error") {
    throw new GoogleCalendarError("reconnect_required", status.lastError ?? "Hay que volver a conectar el correo de Google.");
  }
  if (!status.connected) {
    throw new GoogleCalendarError("not_connected", "El correo de Google no está conectado en esta empresa. Conéctalo en Integraciones.");
  }

  const to = message.to.trim().toLowerCase();
  if (!isValidEmailAddress(to)) {
    throw new GoogleCalendarError("api_error", "El correo del destinatario no es válido.");
  }

  const tokens = await readTokens(client, workspaceId, PROVIDER);
  if (!tokens.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE)) {
    throw new GoogleCalendarError("missing_scope", NOT_GRANTED);
  }

  const raw = buildRawMessage({ ...message, to }, { email: status.accountEmail, name: fromName });
  const doFetch = deps.fetch ?? globalThis.fetch;
  const call = async (token: string) => {
    try {
      return await doFetch(SEND_URL, {
        body: JSON.stringify({ raw }),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      throw new GoogleCalendarError("temporary", "No se pudo contactar con Gmail. Vuelve a intentarlo.");
    }
  };

  let response = await call(await getAccessToken(client, workspaceId, deps, { provider: PROVIDER }));

  // Token revocado o caducado antes de tiempo: una renovación y un reintento.
  if (response.status === 401) {
    response = await call(await getAccessToken(client, workspaceId, deps, { forceRefresh: true, provider: PROVIDER }));
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { errors?: Array<{ reason?: string }>; message?: string };
    };

    if (response.status === 403 && payload.error?.errors?.some((item) => /insufficient/i.test(item.reason ?? ""))) {
      await markReconnectRequired(client, workspaceId, NOT_GRANTED, PROVIDER);
      throw new GoogleCalendarError("missing_scope", NOT_GRANTED, 403);
    }

    const temporary = response.status === 429 || response.status >= 500;
    throw new GoogleCalendarError(
      temporary ? "temporary" : "api_error",
      `Gmail rechazó el envío (HTTP ${response.status}${payload.error?.message ? `: ${payload.error.message}` : ""}).`,
      response.status,
    );
  }

  const sent = (await response.json().catch(() => ({}))) as { id?: unknown };

  return { from: status.accountEmail, id: typeof sent.id === "string" ? sent.id : null };
}
