import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { deleteNote, updateNote } from "@/lib/crm/notes";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ noteId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { noteId } = await params;
    const { body } = (await request.json()) as { body?: unknown };

    return NextResponse.json({ note: await updateNote(createAdminClient(), workspaceId, noteId, body) });
  } catch (error) {
    return apiErrorResponse(error, "crm/notes:patch");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { noteId } = await params;
    await deleteNote(createAdminClient(), workspaceId, noteId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "crm/notes:delete");
  }
}
