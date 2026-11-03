import type { SupabaseClient } from "@supabase/supabase-js";

import { dbFailure, notFound } from "./errors.ts";

/**
 * Cliente con service_role (`createAdminClient`) o uno de pruebas. Todas las
 * funciones del CRM reciben `workspaceId` de la sesión o de un webhook
 * verificado y filtran SIEMPRE por él: con service_role no hay RLS que lo haga.
 */
export type CrmClient = SupabaseClient;

export type CrmActorKind = "agent" | "operator" | "flow" | "system" | "import" | "stripe";

/** Quién hace el cambio; se guarda en la actividad del contacto. */
export type CrmActor = {
  kind: CrmActorKind;
  userId?: string | null;
};

export const SYSTEM_ACTOR: CrmActor = { kind: "system" };

/** Comprueba que el contacto es de la empresa; si no, 404 (sin decir de quién es). */
export async function assertContactInWorkspace(
  client: CrmClient,
  workspaceId: string,
  contactId: string,
) {
  const { data, error } = await client
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    throw dbFailure("assertContactInWorkspace", error);
  }
  if (!data) {
    throw notFound("Ese contacto no existe en esta empresa.");
  }
}
