import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { setContactStage } from "@/lib/crm/stages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const { stageId } = (await request.json()) as { stageId?: string };

    if (!stageId) {
      throw badRequest("Falta la etapa.");
    }

    return NextResponse.json(
      await setContactStage(createAdminClient(), workspaceId, contactId, stageId, { kind: "operator", userId: user.id }),
    );
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/stage");
  }
}
