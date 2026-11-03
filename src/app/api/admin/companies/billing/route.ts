import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { updateWorkspaceBillingAdmin } from "@/lib/billing/admin";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Consola de empresas: marcar exenta o enlazar un cliente de Stripe (superadmin). */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requirePlatformAdmin(user);

    const body = (await request.json()) as { billingExempt?: unknown; stripeCustomerId?: unknown; workspaceId?: unknown };
    if (typeof body.workspaceId !== "string" || !body.workspaceId) {
      return NextResponse.json({ error: "Falta la empresa." }, { status: 400 });
    }

    const billing = await updateWorkspaceBillingAdmin(createAdminClient(), body.workspaceId, {
      billingExempt: body.billingExempt,
      stripeCustomerId: body.stripeCustomerId,
    });

    return NextResponse.json({ billing });
  } catch (error) {
    return apiErrorResponse(error, "admin/companies/billing");
  }
}
