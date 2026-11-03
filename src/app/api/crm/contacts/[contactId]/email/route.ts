import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { sendContactEmail } from "@/lib/crm/contact-email";
import { createAdminClient } from "@/lib/supabase/admin";

/** «Enviar correo» de la ficha: sale del Gmail de la empresa activa. */
export async function POST(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const { body, subject } = (await request.json()) as { body?: unknown; subject?: unknown };
    const sent = await sendContactEmail(createAdminClient(), workspaceId, contactId, { body, subject }, { kind: "operator", userId: user.id });

    return NextResponse.json({ sent }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/email");
  }
}
