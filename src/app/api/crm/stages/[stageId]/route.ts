import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { deleteStage, updateStage } from "@/lib/crm/stages";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ stageId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { stageId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const stage = await updateStage(createAdminClient(), workspaceId, stageId, { color: body.color, kind: body.kind, name: body.name });
    return NextResponse.json({ stage });
  } catch (error) {
    return apiErrorResponse(error, "crm/stage:patch");
  }
}

/** Sus contactos pasan a la primera etapa abierta. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { stageId } = await params;
    await deleteStage(createAdminClient(), workspaceId, stageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "crm/stage:delete");
  }
}
