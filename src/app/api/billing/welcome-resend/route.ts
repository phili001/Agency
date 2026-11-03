import { NextResponse } from "next/server";

import { findAuthUserByEmail } from "@/lib/admin-companies";
import { apiErrorResponse } from "@/lib/api-error";
import { getBillingConfig } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { resendWelcomeAccess, sendWelcomeAccess } from "@/lib/billing/welcome-page";
import { createAdminClient } from "@/lib/supabase/admin";

const FAILURES = {
  not_ready: { error: "Tu cuenta aún se está preparando. Prueba otra vez en un momento.", status: 409 },
  rate_limited: { error: "Ya lo hemos reenviado varias veces. Mira en spam o prueba dentro de una hora.", status: 429 },
  send_failed: { error: "No hemos podido enviarlo. Prueba en un rato o escríbenos a hola@agentelevi.com.", status: 502 },
} as const;

/**
 * «Reenviar» de `/bienvenida`. Es público porque el comprador aún no tiene
 * sesión: lo que autoriza es el id de la sesión de Stripe, y el correo solo
 * sale hacia la dirección con la que se pagó.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
    const admin = createAdminClient();
    const result = await resendWelcomeAccess(body?.sessionId, {
      client: admin,
      config: getBillingConfig(),
      findUserIdByEmail: async (email) => (await findAuthUserByEmail(admin, email))?.id ?? null,
      send: (input) => sendWelcomeAccess(admin, input),
      stripe: getStripe(),
    });

    if (!result.ok) {
      const failure = FAILURES[result.reason];
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return NextResponse.json({ email: result.email });
  } catch (error) {
    return apiErrorResponse(error, "billing/welcome-resend");
  }
}
