import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createTask } from "@/lib/crm/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const task = await createTask(
      createAdminClient(),
      workspaceId,
      contactId,
      {
        assignedTo: typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null,
        detail: body.detail,
        dueAt: body.dueAt,
        title: body.title,
      },
      { kind: "operator", userId: user.id },
    );

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/tasks");
  }
}
