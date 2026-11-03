import { NextResponse } from "next/server";

import { deleteBlock } from "@/lib/agenda/appointments";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { blockId } = await params;
    await deleteBlock(createAdminClient(), workspaceId, blockId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "agenda/block:delete");
  }
}
