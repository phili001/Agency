import type { CrmClient } from "../crm/shared.ts";
import { normalizeStripeCustomerId } from "./links.ts";

/**
 * Cambios de facturación desde la consola de empresas (solo superadmin). El
 * `workspaceId` viene de la consola, que ya comprobó al superadmin.
 */

export class BillingAdminError extends Error {
  readonly status: number;
  readonly userFacing = true;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BillingAdminError";
    this.status = status;
  }
}

async function assertWorkspace(client: CrmClient, workspaceId: string) {
  const { data, error } = await client.from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
  if (error) throw new Error(`workspaces: ${error.message}`);
  if (!data) throw new BillingAdminError(404, "Esa empresa no existe.");
}

export async function updateWorkspaceBillingAdmin(
  client: CrmClient,
  workspaceId: string,
  input: { billingExempt?: unknown; stripeCustomerId?: unknown },
) {
  await assertWorkspace(client, workspaceId);
  const patch: Record<string, unknown> = { workspace_id: workspaceId };

  if (input.billingExempt !== undefined) {
    if (typeof input.billingExempt !== "boolean") throw new BillingAdminError(400, "«Exenta» tiene que ser sí o no.");
    patch.billing_exempt = input.billingExempt;
  }
  if (input.stripeCustomerId !== undefined) {
    if (input.stripeCustomerId === null || input.stripeCustomerId === "") {
      patch.stripe_customer_id = null;
    } else {
      const customerId = normalizeStripeCustomerId(input.stripeCustomerId);
      if (!customerId) throw new BillingAdminError(400, "El cliente de Stripe empieza por cus_.");
      const { data: other, error } = await client
        .from("workspace_billing")
        .select("workspace_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (error) throw new Error(`workspace_billing: ${error.message}`);
      if (other && (other as { workspace_id: string }).workspace_id !== workspaceId) {
        throw new BillingAdminError(409, "Ese cliente de Stripe ya está enlazado a otra empresa.");
      }
      patch.stripe_customer_id = customerId;
    }
  }
  if (Object.keys(patch).length === 1) throw new BillingAdminError(400, "No hay nada que cambiar.");

  const { data, error } = await client
    .from("workspace_billing")
    .upsert(patch, { onConflict: "workspace_id" })
    .select("workspace_id, billing_exempt, stripe_customer_id, status")
    .single();
  if (error || !data) throw new Error(`workspace_billing: ${error?.message ?? "sin fila"}`);
  return data as { billing_exempt: boolean; status: string | null; stripe_customer_id: string | null; workspace_id: string };
}
