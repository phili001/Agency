import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { updateCustomField } from "@/lib/crm/custom-fields";
import { createAdminClient } from "@/lib/supabase/admin";

/** Nombre, opciones, visibilidad para la IA o activo. La clave y el tipo no cambian. */
export async function PATCH(request: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { fieldId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const field = await updateCustomField(createAdminClient(), workspaceId, fieldId, {
      active: typeof body.active === "boolean" ? body.active : undefined,
      ai_readable: typeof body.aiReadable === "boolean" ? body.aiReadable : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
      options: body.options,
    });
    return NextResponse.json({ field });
  } catch (error) {
    return apiErrorResponse(error, "crm/field:patch");
  }
}
