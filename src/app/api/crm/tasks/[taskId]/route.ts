import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { deleteTask, setTaskCompleted, updateTask } from "@/lib/crm/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ taskId: string }> };

/** `{ completed }` marca o desmarca; el resto de campos edita la tarea. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { taskId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const admin = createAdminClient();
    const task =
      typeof body.completed === "boolean"
        ? await setTaskCompleted(admin, workspaceId, taskId, body.completed, { kind: "operator", userId: user.id })
        : await updateTask(admin, workspaceId, taskId, {
            assignedTo: body.assignedTo === undefined ? undefined : (body.assignedTo as string | null),
            detail: body.detail,
            dueAt: body.dueAt,
            title: body.title,
          });

    return NextResponse.json({ task });
  } catch (error) {
    return apiErrorResponse(error, "crm/tasks:patch");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { taskId } = await params;
    await deleteTask(createAdminClient(), workspaceId, taskId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "crm/tasks:delete");
  }
}
