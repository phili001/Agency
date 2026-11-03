import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { deleteTag, updateTag } from "@/lib/crm/tags";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ tagId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { tagId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ tag: await updateTag(createAdminClient(), workspaceId, tagId, { color: body.color, name: body.name }) });
  } catch (error) {
    return apiErrorResponse(error, "crm/tag:patch");
  }
}

/** Se la quita a todos sus contactos. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { tagId } = await params;
    await deleteTag(createAdminClient(), workspaceId, tagId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "crm/tag:delete");
  }
}
