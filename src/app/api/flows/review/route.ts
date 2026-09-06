import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import {
  decideFlowAnswerReview,
  unblockFlowContact,
} from "@/lib/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewPayload = {
  action?: "approve" | "reject" | "unblock";
  contactId?: string;
  reviewId?: string;
  workspaceId?: string;
};

async function deliverQueuedReviewMessages(
  request: Request,
  workspaceId: string,
  conversationId?: string | null,
) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !conversationId) {
    return;
  }

  await fetch(
    `${new URL(request.url).origin}/api/cron/deliver?workspaceId=${encodeURIComponent(
      workspaceId,
    )}&conversationId=${encodeURIComponent(conversationId)}`,
    {
      headers: { Authorization: `Bearer ${cronSecret}` },
      method: "POST",
    },
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ReviewPayload;

    if (!payload.workspaceId || !payload.action) {
      return NextResponse.json(
        { error: "workspaceId y action son requeridos." },
        { status: 400 },
      );
    }

    const allowedRoles =
      payload.action === "unblock"
        ? ["owner", "admin"]
        : ["owner", "admin", "agent"];
    const { user } = await requireWorkspaceRole(payload.workspaceId, allowedRoles);
    const admin = createAdminClient();

    if (payload.action === "unblock") {
      if (!payload.contactId) {
        return NextResponse.json({ error: "contactId requerido." }, { status: 400 });
      }

      const result = await unblockFlowContact({
        contactId: payload.contactId,
        supabase: admin,
        workspaceId: payload.workspaceId,
      });
      return NextResponse.json(result);
    }

    if (!payload.reviewId) {
      return NextResponse.json({ error: "reviewId requerido." }, { status: 400 });
    }

    const { data: reviewContext } = await admin
      .from("flow_answer_reviews")
      .select("conversation_id")
      .eq("id", payload.reviewId)
      .eq("workspace_id", payload.workspaceId)
      .maybeSingle();
    const result = await decideFlowAnswerReview({
      decidedBy: user.id,
      decision: payload.action,
      reviewId: payload.reviewId,
      supabase: admin,
      workspaceId: payload.workspaceId,
    });
    await deliverQueuedReviewMessages(
      request,
      payload.workspaceId,
      reviewContext?.conversation_id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "flows/review");
  }
}
