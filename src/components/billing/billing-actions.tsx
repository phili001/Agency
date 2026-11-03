"use client";

import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

import { readApiError } from "@/components/onboarding/shared";

const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium disabled:opacity-60";

/** «Pagar / reactivar» (Payment Link) y «Gestionar suscripción» (Customer Portal). */
export function BillingActions({ canOpenPortal, paymentUrl }: { canOpenPortal: boolean; paymentUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response, "No se pudo abrir el portal de Stripe."));
      const { url } = (await response.json()) as { url: string };
      window.location.href = url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir el portal de Stripe.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {paymentUrl ? (
          <a className={primaryButton} href={paymentUrl} rel="noopener noreferrer" target="_blank">
            <CreditCard size={16} /> Pagar / reactivar
          </a>
        ) : null}
        {canOpenPortal ? (
          <button className={secondaryButton} disabled={busy} onClick={openPortal} type="button">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />} Gestionar suscripción
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-[#a33a2b]">{error}</p> : null}
    </div>
  );
}
