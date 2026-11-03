import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createStage, listStages, reorderStages } from "@/lib/crm/stages";
import { createAdminClient } from "@/lib/supabase/admin";

/** Etapas del embudo de la empresa activa. Cambiarlas: owner/admin. */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent", "viewer"]);
    return NextResponse.json({ stages: await listStages(createAdminClient(), workspaceId) });
  } catch (error) {
    return apiErrorResponse(error, "crm/stages:get");
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const stage = await createStage(createAdminClient(), workspaceId, { color: body.color, kind: body.kind, name: body.name });
    return NextResponse.json({ stage }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/stages:post");
  }
}

/** `{ ids }` en el orden nuevo (todas las etapas). */
export async function PUT(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { ids } = (await request.json()) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw badRequest("Falta el orden de las etapas.");
    }
    const admin = createAdminClient();
    await reorderStages(admin, workspaceId, ids as string[]);
    return NextResponse.json({ stages: await listStages(admin, workspaceId) });
  } catch (error) {
    return apiErrorResponse(error, "crm/stages:put");
  }
}
