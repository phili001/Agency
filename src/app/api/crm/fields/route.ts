import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createCustomField, listCustomFields, reorderCustomFields } from "@/lib/crm/custom-fields";
import { createAdminClient } from "@/lib/supabase/admin";

/** Campos personalizados (también los desactivados, para poder reactivarlos). */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    return NextResponse.json({ fields: await listCustomFields(createAdminClient(), workspaceId, { includeInactive: true }) });
  } catch (error) {
    return apiErrorResponse(error, "crm/fields:get");
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const field = await createCustomField(createAdminClient(), workspaceId, {
      ai_readable: body.aiReadable === true,
      key: typeof body.key === "string" && body.key ? body.key : undefined,
      label: String(body.label ?? ""),
      options: body.options,
      type: String(body.type ?? ""),
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/fields:post");
  }
}

/** `{ ids }` en el orden nuevo (todos los campos). */
export async function PUT(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { ids } = (await request.json()) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw badRequest("Falta el orden de los campos.");
    }
    const admin = createAdminClient();
    await reorderCustomFields(admin, workspaceId, ids as string[]);
    return NextResponse.json({ fields: await listCustomFields(admin, workspaceId, { includeInactive: true }) });
  } catch (error) {
    return apiErrorResponse(error, "crm/fields:put");
  }
}
