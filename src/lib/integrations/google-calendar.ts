import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { CrmClient } from "../crm/shared.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";

/**
 * Google Calendar por empresa (portado de crm-levy `google_oauth.py`,
 * `google_calendar.py` y `calendar_sync.py`), con `fetch` directo a la API
 * REST: no hace falta la librería de Google para esto.
 *
 * - OAuth: cada empresa conecta su cuenta. El `state` va firmado (HMAC) con la
 *   empresa, el usuario que lo pidió y la caducidad, así el callback no se
 *   puede reutilizar ni apuntar a otra empresa.
 * - Tokens cifrados en `integration_secrets` (provider `google_calendar`, kind
 *   `oauth_tokens`) con `crypto.ts`. Se renuevan solos; si Google rechaza la
 *   renovación (400/401, permiso revocado) la integración pasa a `error` con un
 *   mensaje para el panel. Un fallo de red no desconecta nada.
 * - Eventos con id fijo sacado del id de la cita: reintentar no duplica.
 *
 * Todo recibe sus dependencias (`fetch`, cliente, entorno, reloj) para poder
 * probarlo sin red.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const STATE_TTL_MS = 10 * 60_000;
const EXPIRY_MARGIN_MS = 60_000;
const SECRET_KIND = "oauth_tokens";
const PROVIDER = "google_calendar";

/** Cada conexión guarda sus propios tokens: se conectan y desconectan por separado. */
export type GoogleProvider = "gmail" | "google_calendar";
export type GoogleOAuthPurpose = "calendar" | "gmail";

export type GoogleCalendarErrorCode =
  | "api_error"
  | "invalid_state"
  | "missing_scope"
  | "not_configured"
  | "not_connected"
  | "reconnect_required"
  | "temporary";

const STATUS: Record<GoogleCalendarErrorCode, number> = {
  api_error: 502,
  invalid_state: 400,
  missing_scope: 400,
  not_configured: 503,
  not_connected: 409,
  reconnect_required: 409,
  temporary: 503,
};

export class GoogleCalendarError extends Error {
  readonly code: GoogleCalendarErrorCode;
  readonly httpStatus: number | null;
  readonly status: number;
  readonly userFacing = true;

  constructor(code: GoogleCalendarErrorCode, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "GoogleCalendarError";
    this.code = code;
    this.status = STATUS[code];
    this.httpStatus = httpStatus;
  }
}

export const RECONNECT_MESSAGES = {
  decrypt_failed:
    "No se pueden leer las credenciales guardadas de Google (la clave de cifrado cambió). Vuelve a conectar Google Calendar.",
  no_refresh_token:
    "La conexión con Google se guardó sin permiso permanente. Vuelve a conectar Google Calendar y concede el acceso.",
  refresh_rejected:
    "Google ha retirado el acceso (permiso revocado o contraseña cambiada). Vuelve a conectar Google Calendar.",
} as const;

function reconnectMessage(key: keyof typeof RECONNECT_MESSAGES, provider: GoogleProvider) {
  return provider === "gmail"
    ? RECONNECT_MESSAGES[key].replace("Google Calendar", "el correo de Google")
    : RECONNECT_MESSAGES[key];
}

export type GoogleDeps = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => Date;
};

function depsOf(deps: GoogleDeps = {}) {
  return {
    env: deps.env ?? process.env,
    fetch: deps.fetch ?? globalThis.fetch,
    now: deps.now ?? (() => new Date()),
  };
}

// --- Configuración y state ----------------------------------------------------------

export function getGoogleOAuthConfig(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  if (!clientId || !clientSecret || !appUrl) {
    return null;
  }

  return { clientId, clientSecret, redirectUri: `${appUrl}/api/integrations/google-calendar/callback` };
}

function requireConfig(env: Record<string, string | undefined>) {
  const config = getGoogleOAuthConfig(env);

  if (!config) {
    throw new GoogleCalendarError("not_configured", "Google Calendar no está configurado en el servidor (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  }

  return config;
}

function stateKey(env: Record<string, string | undefined>) {
  const secret = env.INTEGRATION_ENCRYPTION_KEY;

  if (!secret || secret.length < 16) {
    throw new GoogleCalendarError("not_configured", "Falta INTEGRATION_ENCRYPTION_KEY en el servidor.");
  }

  return createHmac("sha256", secret).update("google-oauth-state").digest();
}

function sign(payload: string, env: Record<string, string | undefined>) {
  return createHmac("sha256", stateKey(env)).update(payload).digest("base64url");
}

export function createOAuthState(
  { purpose = "calendar", userId, workspaceId }: { purpose?: GoogleOAuthPurpose; userId: string; workspaceId: string },
  deps: GoogleDeps = {},
) {
  const { env, now } = depsOf(deps);
  const payload = Buffer.from(
    JSON.stringify({ exp: now().getTime() + STATE_TTL_MS, n: randomBytes(12).toString("base64url"), p: purpose, u: userId, w: workspaceId }),
  ).toString("base64url");

  return `${payload}.${sign(payload, env)}`;
}

/** Comprueba firma, caducidad y que lo abre el mismo usuario que lo pidió. */
export function verifyOAuthState(state: string | null | undefined, expectedUserId: string, deps: GoogleDeps = {}) {
  const { env, now } = depsOf(deps);
  const invalid = () => new GoogleCalendarError("invalid_state", "El enlace de conexión con Google no es válido o ha caducado. Vuelve a intentarlo.");
  const [payload, signature] = (state ?? "").split(".");

  if (!payload || !signature) {
    throw invalid();
  }

  const expected = Buffer.from(sign(payload, env));
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw invalid();
  }

  let data: { exp?: number; p?: string; u?: string; w?: string };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }

  if (!data.w || !data.u || typeof data.exp !== "number" || data.exp < now().getTime() || data.u !== expectedUserId) {
    throw invalid();
  }

  return { purpose: (data.p === "gmail" ? "gmail" : "calendar") as GoogleOAuthPurpose, userId: data.u, workspaceId: data.w };
}

export function buildAuthUrl(state: string, deps: GoogleDeps = {}, scopes: string[] = GOOGLE_SCOPES) {
  const config = requireConfig(depsOf(deps).env);
  const url = new URL(AUTH_URL);

  url.search = new URLSearchParams({
    access_type: "offline",
    client_id: config.clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  }).toString();

  return url.toString();
}

// --- Tokens -----------------------------------------------------------------------

export type GoogleTokens = {
  accessToken: string;
  expiresAt: string;
  refreshToken: string | null;
  scope: string;
};

async function tokenRequest(body: Record<string, string>, deps: GoogleDeps) {
  const { env, fetch: doFetch, now } = depsOf(deps);
  const config = requireConfig(env);
  let response: Response;

  try {
    response = await doFetch(TOKEN_URL, {
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
  } catch {
    throw new GoogleCalendarError("temporary", "No se pudo contactar con Google. Se reintentará.");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };

  if (!response.ok || !payload.access_token) {
    const permanent = response.status === 400 || response.status === 401;
    throw new GoogleCalendarError(
      permanent ? "reconnect_required" : "temporary",
      permanent ? RECONNECT_MESSAGES.refresh_rejected : "Google no respondió bien al renovar el acceso. Se reintentará.",
      response.status,
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(now().getTime() + (payload.expires_in ?? 3600) * 1000).toISOString(),
    refreshToken: payload.refresh_token ?? null,
    scope: payload.scope ?? "",
  } satisfies GoogleTokens;
}

export async function exchangeCode(
  code: string,
  deps: GoogleDeps = {},
  {
    missingMessage = "Hay que conceder acceso para ver y crear eventos del calendario. Vuelve a conectar y marca todas las casillas.",
    provider = PROVIDER,
    requiredScopes = GOOGLE_SCOPES,
  }: { missingMessage?: string; provider?: GoogleProvider; requiredScopes?: string[] } = {},
) {
  const config = requireConfig(depsOf(deps).env);
  const tokens = await tokenRequest(
    { code, grant_type: "authorization_code", redirect_uri: config.redirectUri },
    deps,
  ).catch((error) => {
    if (error instanceof GoogleCalendarError && error.code === "reconnect_required") {
      throw new GoogleCalendarError("invalid_state", "Google no aceptó la autorización. Vuelve a intentarlo.", error.httpStatus);
    }
    throw error;
  });
  const granted = tokens.scope.split(/\s+/);

  if (!requiredScopes.every((scope) => granted.includes(scope))) {
    throw new GoogleCalendarError("missing_scope", missingMessage);
  }
  if (!tokens.refreshToken) {
    throw new GoogleCalendarError("reconnect_required", reconnectMessage("no_refresh_token", provider));
  }

  return tokens;
}

export async function saveTokens(client: CrmClient, workspaceId: string, tokens: GoogleTokens, provider: GoogleProvider = PROVIDER) {
  const { error } = await client.from("integration_secrets").upsert(
    { ciphertext: encryptSecret(JSON.stringify(tokens)), kind: SECRET_KIND, provider, workspace_id: workspaceId },
    { onConflict: "workspace_id,provider,kind" },
  );

  if (error) {
    throw new Error(`[google:saveTokens] ${error.message}`);
  }
}

export async function setIntegration(
  client: CrmClient,
  workspaceId: string,
  changes: { config?: Record<string, unknown>; last_error: string | null; status: "active" | "disabled" | "error" },
  provider: GoogleProvider = PROVIDER,
) {
  const { error } = await client
    .from("integrations")
    .upsert({ provider, workspace_id: workspaceId, ...changes }, { onConflict: "workspace_id,provider" });

  if (error) {
    throw new Error(`[google:setIntegration] ${error.message}`);
  }
}

/** Fallo definitivo: la integración queda en `error` con el motivo para el panel. */
export async function markReconnectRequired(client: CrmClient, workspaceId: string, message: string, provider: GoogleProvider = PROVIDER) {
  await setIntegration(client, workspaceId, { last_error: message, status: "error" }, provider);
  return new GoogleCalendarError("reconnect_required", message);
}

/** Guarda la conexión tras el callback y deja la integración activa. */
export async function saveConnection(client: CrmClient, workspaceId: string, tokens: GoogleTokens, deps: GoogleDeps = {}) {
  await saveTokens(client, workspaceId, tokens);

  // El id del calendario principal es el correo de la cuenta: sirve para
  // enseñar «Conectado como …» sin pedir el scope de perfil.
  let accountEmail: string | null = null;
  try {
    const calendars = await listCalendars(client, workspaceId, deps, tokens.accessToken);
    accountEmail = calendars.find((calendar) => calendar.primary)?.id ?? null;
  } catch {
    accountEmail = null;
  }

  await setIntegration(client, workspaceId, {
    config: { account_email: accountEmail, connected_at: depsOf(deps).now().toISOString(), scopes: tokens.scope.split(/\s+/) },
    last_error: null,
    status: "active",
  });

  return { accountEmail };
}

export async function readTokens(client: CrmClient, workspaceId: string, provider: GoogleProvider = PROVIDER) {
  const { data, error } = await client
    .from("integration_secrets")
    .select("ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("kind", SECRET_KIND)
    .maybeSingle();

  if (error) {
    throw new Error(`[google:readTokens] ${error.message}`);
  }
  if (!data) {
    throw new GoogleCalendarError(
      "not_connected",
      provider === "gmail" ? "El correo de Google no está conectado." : "Google Calendar no está conectado.",
    );
  }

  try {
    return JSON.parse(decryptSecret((data as { ciphertext: string }).ciphertext)) as GoogleTokens;
  } catch {
    throw await markReconnectRequired(client, workspaceId, reconnectMessage("decrypt_failed", provider), provider);
  }
}

/** Access token válido; renueva si caduca en menos de un minuto o si se fuerza. */
export async function getAccessToken(
  client: CrmClient,
  workspaceId: string,
  deps: GoogleDeps = {},
  { forceRefresh = false, provider = PROVIDER }: { forceRefresh?: boolean; provider?: GoogleProvider } = {},
) {
  const { now } = depsOf(deps);
  const tokens = await readTokens(client, workspaceId, provider);

  if (!forceRefresh && new Date(tokens.expiresAt).getTime() - EXPIRY_MARGIN_MS > now().getTime()) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw await markReconnectRequired(client, workspaceId, reconnectMessage("no_refresh_token", provider), provider);
  }

  let fresh: GoogleTokens;
  try {
    fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }, deps);
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.code === "reconnect_required") {
      throw await markReconnectRequired(client, workspaceId, reconnectMessage("refresh_rejected", provider), provider);
    }
    throw error;
  }

  // Google puede renovar sin repetir `scope`: se conserva lo concedido.
  await saveTokens(
    client,
    workspaceId,
    { ...fresh, refreshToken: fresh.refreshToken ?? tokens.refreshToken, scope: fresh.scope || tokens.scope },
    provider,
  );
  await setIntegration(client, workspaceId, { last_error: null, status: "active" }, provider).catch(() => undefined);

  return fresh.accessToken;
}

export async function getConnectionStatus(client: CrmClient, workspaceId: string, env: Record<string, string | undefined> = process.env) {
  const { data, error } = await client
    .from("integrations")
    .select("status, config, last_error")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(`[google:status] ${error.message}`);
  }

  const row = data as { config: Record<string, unknown> | null; last_error: string | null; status: string } | null;

  return {
    accountEmail: typeof row?.config?.account_email === "string" ? row.config.account_email : null,
    configured: getGoogleOAuthConfig(env) !== null,
    connected: row?.status === "active",
    lastError: row?.last_error ?? null,
    status: (row?.status ?? "disconnected") as "active" | "disabled" | "disconnected" | "error" | "pending",
  };
}

/**
 * Revoca en Google (si se puede), borra los tokens y desactiva la integración.
 * Revocar quita a la app todo el acceso de esa cuenta, así que si la otra
 * conexión de Google de la empresa sigue activa solo se borran los tokens.
 */
export async function disconnect(client: CrmClient, workspaceId: string, deps: GoogleDeps = {}, provider: GoogleProvider = PROVIDER) {
  const { fetch: doFetch } = depsOf(deps);

  try {
    const { data: other } = await client
      .from("integrations")
      .select("status")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider === "gmail" ? PROVIDER : "gmail")
      .maybeSingle();

    if ((other as { status: string } | null)?.status !== "active") {
      const tokens = await readTokens(client, workspaceId, provider);
      const token = tokens.refreshToken ?? tokens.accessToken;
      await doFetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
    }
  } catch {
    // Sin tokens legibles no hay nada que revocar.
  }

  const { error } = await client
    .from("integration_secrets")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`[google:disconnect] ${error.message}`);
  }

  await setIntegration(client, workspaceId, { last_error: null, status: "disabled" }, provider);
}

// --- API de Calendar ------------------------------------------------------------------

async function calendarFetch(
  client: CrmClient,
  workspaceId: string,
  path: string,
  init: RequestInit,
  deps: GoogleDeps,
  accessToken?: string,
) {
  const { fetch: doFetch } = depsOf(deps);
  const call = async (token: string) => {
    try {
      return await doFetch(`${CALENDAR_API}${path}`, {
        ...init,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch {
      throw new GoogleCalendarError("temporary", "No se pudo contactar con Google Calendar. Se reintentará.");
    }
  };

  let response = await call(accessToken ?? (await getAccessToken(client, workspaceId, deps)));

  // Token revocado o caducado antes de tiempo: una renovación y un reintento.
  if (response.status === 401 && !accessToken) {
    response = await call(await getAccessToken(client, workspaceId, deps, { forceRefresh: true }));
  }

  return response;
}

async function failure(response: Response, context: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  const temporary = response.status === 429 || response.status >= 500;

  return new GoogleCalendarError(
    temporary ? "temporary" : "api_error",
    `Google Calendar rechazó ${context} (HTTP ${response.status}${payload.error?.message ? `: ${payload.error.message}` : ""}).`,
    response.status,
  );
}

export type GoogleCalendarSummary = { accessRole: string; id: string; primary: boolean; summary: string; timeZone: string | null };

export async function listCalendars(client: CrmClient, workspaceId: string, deps: GoogleDeps = {}, accessToken?: string) {
  const response = await calendarFetch(client, workspaceId, "/users/me/calendarList?minAccessRole=reader", { method: "GET" }, deps, accessToken);

  if (!response.ok) {
    throw await failure(response, "la lista de calendarios");
  }

  const payload = (await response.json()) as { items?: Array<Record<string, unknown>> };

  return (payload.items ?? []).map(
    (item): GoogleCalendarSummary => ({
      accessRole: String(item.accessRole ?? "reader"),
      id: String(item.id),
      primary: item.primary === true,
      summary: String(item.summaryOverride ?? item.summary ?? item.id),
      timeZone: typeof item.timeZone === "string" ? item.timeZone : null,
    }),
  );
}

/** Calendarios en los que se pueden crear eventos (para elegir el de una agenda). */
export function writableCalendars(calendars: GoogleCalendarSummary[]) {
  return calendars.filter((calendar) => calendar.accessRole === "owner" || calendar.accessRole === "writer");
}

/** Tramos ocupados de los calendarios en [from, to). */
export async function freeBusy(
  client: CrmClient,
  workspaceId: string,
  calendarIds: string[],
  from: Date,
  to: Date,
  deps: GoogleDeps = {},
) {
  if (calendarIds.length === 0) {
    return [];
  }

  const response = await calendarFetch(
    client,
    workspaceId,
    "/freeBusy",
    {
      body: JSON.stringify({ items: calendarIds.map((id) => ({ id })), timeMax: to.toISOString(), timeMin: from.toISOString() }),
      method: "POST",
    },
    deps,
  );

  if (!response.ok) {
    throw await failure(response, "la consulta de ocupado");
  }

  const payload = (await response.json()) as {
    calendars?: Record<string, { busy?: Array<{ end?: string; start?: string }>; errors?: unknown[] }>;
  };
  const intervals: Array<{ end: Date; start: Date }> = [];

  for (const info of Object.values(payload.calendars ?? {})) {
    for (const busy of info.busy ?? []) {
      const start = new Date(busy.start ?? "");
      const end = new Date(busy.end ?? "");
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        intervals.push({ end, start });
      }
    }
  }

  return intervals;
}

/**
 * Id del evento en Google: el de la cita en hexadecimal sin guiones (Google
 * admite 0-9 y a-v, de 5 a 1024 caracteres). Fijo por cita: un reintento
 * choca con el mismo evento en vez de crear otro.
 */
export function eventIdForAppointment(appointmentId: string) {
  const id = appointmentId.replace(/-/g, "").toLowerCase();

  if (!/^[0-9a-v]{5,1024}$/.test(id)) {
    throw new Error(`Id de cita no válido para Google: ${appointmentId}`);
  }

  return id;
}

export type GoogleEventInput = {
  description?: string | null;
  end: Date;
  start: Date;
  summary: string;
  timeZone: string;
};

export function buildEventBody(input: GoogleEventInput) {
  return {
    description: input.description ?? undefined,
    end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    reminders: { useDefault: true },
    start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
    summary: input.summary.slice(0, 200),
  };
}

/**
 * Crea o actualiza el evento de una cita. Si ya existía (409) se actualiza; si
 * lo borraron a mano en Google (404/410 al actualizar) se vuelve a crear.
 */
export async function upsertEvent(
  client: CrmClient,
  workspaceId: string,
  calendarId: string,
  appointmentId: string,
  input: GoogleEventInput,
  deps: GoogleDeps = {},
) {
  const eventId = eventIdForAppointment(appointmentId);
  const calendarPath = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const body = buildEventBody(input);
  const created = await calendarFetch(
    client,
    workspaceId,
    `${calendarPath}?sendUpdates=none`,
    { body: JSON.stringify({ ...body, id: eventId }), method: "POST" },
    deps,
  );

  if (created.ok) {
    return { eventId, result: "created" as const };
  }
  if (created.status !== 409) {
    throw await failure(created, "la creación del evento");
  }

  const updated = await calendarFetch(
    client,
    workspaceId,
    `${calendarPath}/${eventId}?sendUpdates=none`,
    { body: JSON.stringify({ ...body, status: "confirmed" }), method: "PUT" },
    deps,
  );

  if (!updated.ok) {
    throw await failure(updated, "la actualización del evento");
  }

  return { eventId, result: "updated" as const };
}

/** Borra un evento. Ya borrado (404/410) cuenta como hecho. */
export async function deleteEvent(
  client: CrmClient,
  workspaceId: string,
  calendarId: string,
  eventId: string,
  deps: GoogleDeps = {},
) {
  const response = await calendarFetch(
    client,
    workspaceId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" },
    deps,
  );

  if (response.ok || response.status === 404 || response.status === 410) {
    return;
  }

  throw await failure(response, "el borrado del evento");
}
