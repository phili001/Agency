/**
 * Estado de facturación de una empresa: `ok`, `aviso` (sigue funcionando, el
 * panel avisa) o `bloqueado` (la IA no responde ni se envía nada; lo entrante
 * se guarda y no se borra nada). Reglas puras, sin base de datos.
 *
 * - Exenta → ok.
 * - Sin fila o sin suscripción todavía → aviso (no se bloquea a nadie por no
 *   tener registro: las empresas nuevas lo tienen desde el webhook de Stripe).
 * - active/trialing → ok (aviso si se cancela al final del periodo).
 * - incomplete → aviso; past_due → aviso hasta `past_due_since + gracia`,
 *   luego bloqueado.
 * - canceled/unpaid/incomplete_expired/paused → bloqueado.
 */

export type StripeSubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "paused"
  | "trialing"
  | "unpaid";

export type WorkspaceBillingRow = {
  billing_exempt: boolean;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  past_due_since: string | null;
  status: StripeSubscriptionStatus | null;
  stripe_customer_id?: string | null;
  workspace_id: string;
};

export type BillingStateKind = "aviso" | "bloqueado" | "ok";

export type BillingReason =
  | "cancel_scheduled"
  | "canceled"
  | "exempt"
  | "incomplete"
  | "no_subscription"
  | "paid"
  | "past_due_blocked"
  | "past_due_grace"
  | "paused"
  | "unpaid";

export type WorkspaceBillingState = {
  /** Hasta cuándo dura la gracia de un impago (solo `past_due_grace`). */
  graceEndsAt: string | null;
  reason: BillingReason;
  state: BillingStateKind;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Estados de Stripe que pueden acabar en bloqueo (para filtrar en la consulta). */
export const BLOCKABLE_STATUSES: StripeSubscriptionStatus[] = [
  "canceled",
  "incomplete_expired",
  "past_due",
  "paused",
  "unpaid",
];

export function computeBillingState(
  row: WorkspaceBillingRow | null,
  { graceDays, now }: { graceDays: number; now: Date },
): WorkspaceBillingState {
  const result = (state: BillingStateKind, reason: BillingReason, graceEndsAt: string | null = null) => ({
    graceEndsAt,
    reason,
    state,
  });

  if (row?.billing_exempt) return result("ok", "exempt");
  if (!row?.status) return result("aviso", "no_subscription");

  switch (row.status) {
    case "active":
    case "trialing":
      return row.cancel_at_period_end ? result("aviso", "cancel_scheduled") : result("ok", "paid");
    case "incomplete":
      return result("aviso", "incomplete");
    case "past_due": {
      const since = row.past_due_since ? new Date(row.past_due_since).getTime() : now.getTime();
      const ends = new Date(since + graceDays * DAY_MS);
      return ends.getTime() > now.getTime()
        ? result("aviso", "past_due_grace", ends.toISOString())
        : result("bloqueado", "past_due_blocked");
    }
    case "paused":
      return result("bloqueado", "paused");
    case "unpaid":
      return result("bloqueado", "unpaid");
    case "canceled":
    case "incomplete_expired":
      return result("bloqueado", "canceled");
  }
}

/** Texto para el panel (banner o pantalla «Reactiva tu suscripción»). */
export function billingMessage(state: WorkspaceBillingState) {
  switch (state.reason) {
    case "no_subscription":
      return "Tu empresa todavía no tiene una suscripción activa a Levy.";
    case "cancel_scheduled":
      return "La suscripción se cancelará al final del periodo actual.";
    case "incomplete":
      return "El primer pago de la suscripción está pendiente.";
    case "past_due_grace":
      return "No se pudo cobrar la suscripción. Actualiza el pago para que Levy siga respondiendo.";
    case "past_due_blocked":
    case "unpaid":
      return "La suscripción está impagada: Levy ha dejado de responder. Reactívala para continuar.";
    case "paused":
      return "La suscripción está en pausa: Levy no responde mientras tanto.";
    case "canceled":
      return "La suscripción está cancelada: Levy ha dejado de responder. Reactívala para continuar.";
    default:
      return "";
  }
}
