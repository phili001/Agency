import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { addNote } from "@/lib/crm/notes";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const { body } = (await request.json()) as { body?: unknown };
    const note = await addNote(createAdminClient(), workspaceId, contactId, body, { kind: "operator", userId: user.id });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/notes");
  }
}
