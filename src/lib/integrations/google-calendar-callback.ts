import "server-only";

import type { CrmClient } from "../crm/shared.ts";
import {
  type GoogleDeps,
  GoogleCalendarError,
  exchangeCode,
  saveConnection,
  verifyOAuthState,
} from "./google-calendar.ts";

/**
 * Vuelta de Google tras conectar (`/api/integrations/google-calendar/callback`).
 * La empresa sale del `state` firmado, no de la query; además se comprueba que
 * quien vuelve es el mismo usuario que lo pidió y que sigue siendo owner/admin
 * de esa empresa. Devuelve a dónde redirigir dentro del panel, con un mensaje
 * que se puede enseñar (nunca detalles internos).
 */
export const INTEGRATIONS_PATH = "/integraciones";

export type CallbackResult = { message: string; ok: false } | { accountEmail: string | null; ok: true; workspaceId: string };

export async function completeGoogleCallback(
  client: CrmClient,
  params: { code: string | null; error: string | null; state: string | null },
  userId: string,
  deps: GoogleDeps = {},
): Promise<CallbackResult> {
  try {
    const { workspaceId } = verifyOAuthState(params.state, userId, deps);

    if (params.error) {
      return {
        message: params.error === "access_denied" ? "Cancelaste la conexión con Google." : "Google no completó la conexión.",
        ok: false,
      };
    }
    if (!params.code) {
      return { message: "Google no devolvió el código de autorización.", ok: false };
    }

    const { data: membership, error } = await client
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
      return { message: "No tienes permisos para conectar Google en esta empresa.", ok: false };
    }

    const tokens = await exchangeCode(params.code, deps);
    const { accountEmail } = await saveConnection(client, workspaceId, tokens, deps);

    return { accountEmail, ok: true, workspaceId };
  } catch (error) {
    if (error instanceof GoogleCalendarError) {
      return { message: error.message, ok: false };
    }
    console.error("[google-calendar:callback]", error);
    return { message: "No se pudo completar la conexión con Google. Vuelve a intentarlo.", ok: false };
  }
}

export function callbackRedirectPath(result: CallbackResult) {
  const query = new URLSearchParams(
    result.ok ? { google: "conectado" } : { google: "error", motivo: result.message.slice(0, 300) },
  );

  return `${INTEGRATIONS_PATH}?${query.toString()}`;
}
