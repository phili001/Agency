import { buildPaymentLinkUrl } from "@/lib/billing/links";
import { billingMessage, computeBillingState } from "@/lib/billing/state";
import { getWorkspaceBillingRow } from "@/lib/billing/workspace-billing";
import { getBillingConfig } from "@/lib/billing/config";
import { createAdminClient } from "@/lib/supabase/admin";

import { BillingActions } from "./billing-actions";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  canceled: "Cancelada",
  incomplete: "Pago pendiente",
  incomplete_expired: "Caducada",
  past_due: "Impagada",
  paused: "En pausa",
  trialing: "En prueba",
  unpaid: "Impagada",
};

/**
 * Facturación de la empresa en «Negocio» (owner/admin la ven; solo el owner
 * paga o abre el portal). Los datos salen del servidor, no del navegador.
 */
export async function BillingCard({ email, role, workspaceId }: { email: string | null; role: string; workspaceId: string }) {
  if (role !== "owner" && role !== "admin") return null;

  let row = null;
  try {
    row = await getWorkspaceBillingRow(createAdminClient(), workspaceId);
  } catch (error) {
    console.error("[billing] Tarjeta sin estado:", error instanceof Error ? error.message : error);
    return null;
  }

  const config = getBillingConfig();
  const state = computeBillingState(row, { graceDays: config.graceDays, now: new Date() });
  const isOwner = role === "owner";
  const exempt = Boolean(row?.billing_exempt);
  const paid = state.state === "ok" && !exempt;
  const paymentUrl = isOwner && !exempt && !paid ? buildPaymentLinkUrl(process.env.STRIPE_PAYMENT_LINK_URL, { email, workspaceId }) : null;
  const message = billingMessage(state);

  return (
    <section className="mx-5 mt-5 rounded-lg border border-line bg-white p-4">
      <h2 className="text-base font-semibold">Facturación</h2>
      <p className="mt-1 text-sm text-muted">
        {exempt
          ? "Esta empresa no paga suscripción (exenta)."
          : row?.status
            ? `Suscripción: ${STATUS_LABELS[row.status] ?? row.status}${
                row.current_period_end
                  ? ` · ${row.cancel_at_period_end ? "termina" : "se renueva"} el ${new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(row.current_period_end))}`
                  : ""
              }`
            : "Todavía no hay una suscripción a Levy."}
      </p>
      {message && !exempt ? <p className="mt-1 text-sm">{message}</p> : null}
      {!isOwner && !exempt ? <p className="mt-2 text-xs text-muted">Solo el dueño de la cuenta puede pagar o cambiar la suscripción.</p> : null}
      {isOwner && !exempt ? (
        <div className="mt-3">
          <BillingActions canOpenPortal={Boolean(row?.stripe_customer_id) && config.secretKey !== null} paymentUrl={paymentUrl} />
        </div>
      ) : null}
    </section>
  );
}
