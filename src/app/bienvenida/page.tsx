import type { Metadata } from "next";

import { WelcomeView } from "@/components/billing/welcome-view";
import { PublicShell } from "@/components/brand/public-shell";
import { findAuthUserByEmail } from "@/lib/admin-companies";
import { getBillingConfig } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { getWelcomeState, isCheckoutSessionId, type WelcomeState } from "@/lib/billing/welcome-page";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  // La URL lleva el id de la sesión de pago: que no salga hacia otros sitios.
  referrer: "no-referrer",
  title: "Bienvenida",
};

async function loadState(sessionId: unknown): Promise<WelcomeState | { status: "unavailable" }> {
  if (!isCheckoutSessionId(sessionId)) return { status: "not_found" };

  try {
    const admin = createAdminClient();
    return await getWelcomeState(sessionId, {
      client: admin,
      config: getBillingConfig(),
      findUserIdByEmail: async (email) => (await findAuthUserByEmail(admin, email))?.id ?? null,
      stripe: getStripe(),
    });
  } catch (error) {
    console.error(`[bienvenida] no se pudo leer el pago: ${error instanceof Error ? error.message : "error"}`);
    return { status: "unavailable" };
  }
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const { session_id: sessionId } = await searchParams;
  const state = await loadState(sessionId);

  return (
    <PublicShell>
      <WelcomeView sessionId={typeof sessionId === "string" ? sessionId : ""} state={state} />
    </PublicShell>
  );
}
