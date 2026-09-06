import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { stopContactFlow } from "@/lib/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";

type StopFlowPayload = {
  contactId?: string;
  conversationId?: string;
  nextMode?: "ai" | "handoff";
  reason?: string;
  workspaceId?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StopFlowPayload;

    if (!payload.workspaceId || !payload.contactId) {
      return NextResponse.json(
        { error: "workspaceId y contactId son requeridos." },
        { status: 400 },
      );
    }

    const { user } = await requireWorkspaceRole(payload.workspaceId, [
      "owner",
      "admin",
      "agent",
    ]);
    const result = await stopContactFlow({
      contactId: payload.contactId,
      conversationId: payload.conversationId,
      nextMode: payload.nextMode === "ai" ? "ai" : "handoff",
      reason: payload.reason,
      stoppedBy: user.id,
      supabase: createAdminClient(),
      workspaceId: payload.workspaceId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "flows/stop");
  }
}
