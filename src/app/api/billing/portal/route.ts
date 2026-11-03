import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { normalizeAppUrl } from "@/lib/app-url";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { getStripe } from "@/lib/billing/stripe";
import { getWorkspaceBillingRow } from "@/lib/billing/workspace-billing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Customer Portal de Stripe para la empresa activa (solo owner): cambiar la
 * tarjeta, ver facturas o cancelar. Devuelve la URL; el navegador va a ella.
 */
export async function POST() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner"]);
    const row = await getWorkspaceBillingRow(createAdminClient(), workspaceId);
    const customerId = row?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        { error: "Todavía no hay una suscripción de Stripe en esta empresa: usa «Pagar / reactivar»." },
        { status: 409 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)}/negocio`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiErrorResponse(error, "billing/portal");
  }
}
