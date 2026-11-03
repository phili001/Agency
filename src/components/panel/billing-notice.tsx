import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";

import { billingMessage, type WorkspaceBillingState } from "@/lib/billing/state";
import { getWorkspaceBillingState } from "@/lib/billing/workspace-billing";
import { createAdminClient } from "@/lib/supabase/admin";

async function readState(workspaceId: string): Promise<WorkspaceBillingState | null> {
  try {
    return await getWorkspaceBillingState(createAdminClient(), workspaceId);
  } catch (error) {
    // Sin dato de facturación no se molesta a nadie: el corte real está en el servidor.
    console.error("[billing] Aviso del panel sin estado:", error instanceof Error ? error.message : error);
    return null;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(value));
}

/**
 * Aviso de facturación encima de cada sección. `bloqueado` → «Reactiva tu
 * suscripción» (los datos siguen ahí, la IA no responde); `aviso` → banner.
 * Solo lo ven owner/admin: el resto del equipo no puede pagar.
 */
export async function BillingNotice({ role, workspaceId }: { role: string; workspaceId: string }) {
  if (role !== "owner" && role !== "admin") return null;

  const state = await readState(workspaceId);
  if (!state || state.state === "ok") return null;

  const message = billingMessage(state);
  // Sin suscripción solo se avisa si hay a dónde ir a pagar.
  if (state.reason === "no_subscription" && !process.env.STRIPE_PAYMENT_LINK_URL?.trim()) return null;
  const cta = (
    <Link className="font-medium underline" href="/negocio">
      {role === "owner" ? "Ir a Facturación" : "Ver Facturación"}
    </Link>
  );

  if (state.state === "bloqueado") {
    return (
      <div className="border-b border-[#f1c9bf] bg-[#fbeeea] px-5 py-4 text-[#7a2a1d]" role="alert">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 shrink-0" size={20} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Reactiva tu suscripción</p>
            <p className="mt-1 text-sm">{message}</p>
            <p className="mt-1 text-xs">
              Tus conversaciones, contactos y citas siguen guardados; los mensajes que lleguen también se guardan.
            </p>
            <p className="mt-2 text-sm">{cta}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[#f3dfb0] bg-[#fdf6e3] px-5 py-3 text-[#6b4e0e]" role="status">
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 shrink-0" size={16} />
        <span>
          {message}
          {state.graceEndsAt ? ` Levy seguirá respondiendo hasta el ${formatDate(state.graceEndsAt)}.` : ""} {cta}
        </span>
      </p>
    </div>
  );
}
