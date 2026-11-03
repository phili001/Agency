import "server-only";

import type { CrmClient } from "../crm/shared.ts";
import {
  type GoogleDeps,
  type GoogleOAuthPurpose,
  GoogleCalendarError,
  exchangeCode,
  saveConnection,
  verifyOAuthState,
} from "./google-calendar.ts";
import { exchangeGmailCode, saveGmailConnection } from "./gmail.ts";

/**
 * Vuelta de Google tras conectar (`/api/integrations/google-calendar/callback`).
 * La empresa sale del `state` firmado, no de la query; además se comprueba que
 * quien vuelve es el mismo usuario que lo pidió y que sigue siendo owner/admin
 * de esa empresa. Devuelve a dónde redirigir dentro del panel, con un mensaje
 * que se puede enseñar (nunca detalles internos).
 */
export const INTEGRATIONS_PATH = "/integraciones";

export type CallbackResult =
  | { message: string; ok: false; purpose?: GoogleOAuthPurpose }
  | { accountEmail: string | null; ok: true; purpose: GoogleOAuthPurpose; workspaceId: string };

export async function completeGoogleCallback(
  client: CrmClient,
  params: { code: string | null; error: string | null; state: string | null },
  userId: string,
  deps: GoogleDeps = {},
): Promise<CallbackResult> {
  let purpose: GoogleOAuthPurpose | undefined;

  try {
    const verified = verifyOAuthState(params.state, userId, deps);
    const { workspaceId } = verified;
    purpose = verified.purpose;

    if (params.error) {
      return {
        message: params.error === "access_denied" ? "Cancelaste la conexión con Google." : "Google no completó la conexión.",
        ok: false,
        purpose,
      };
    }
    if (!params.code) {
      return { message: "Google no devolvió el código de autorización.", ok: false, purpose };
    }

    const { data: membership, error } = await client
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
      return { message: "No tienes permisos para conectar Google en esta empresa.", ok: false, purpose };
    }

    const { accountEmail } =
      purpose === "gmail"
        ? await saveGmailConnection(client, workspaceId, await exchangeGmailCode(params.code, deps), deps)
        : await saveConnection(client, workspaceId, await exchangeCode(params.code, deps), deps);

    return { accountEmail, ok: true, purpose, workspaceId };
  } catch (error) {
    if (error instanceof GoogleCalendarError) {
      return { message: error.message, ok: false, purpose };
    }
    console.error("[google-calendar:callback]", error);
    return { message: "No se pudo completar la conexión con Google. Vuelve a intentarlo.", ok: false, purpose };
  }
}

export function callbackRedirectPath(result: CallbackResult) {
  const key = result.purpose === "gmail" ? "gmail" : "google";
  const query = new URLSearchParams(
    result.ok ? { [key]: "conectado" } : { [key]: "error", motivo: result.message.slice(0, 300) },
  );

  return `${INTEGRATIONS_PATH}?${query.toString()}`;
}
