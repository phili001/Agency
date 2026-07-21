import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { startManualContactFlow } from "@/lib/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";

type StartFlowPayload = {
  contactId?: string;
  conversationId?: string;
  flowId?: string;
  workspaceId?: string;
};

async function deliverFirstMessage(
  request: Request,
  workspaceId: string,
  conversationId: string,
) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const response = await fetch(
    `${new URL(request.url).origin}/api/cron/deliver?workspaceId=${encodeURIComponent(
      workspaceId,
    )}&conversationId=${encodeURIComponent(conversationId)}`,
    {
      headers: { Authorization: `Bearer ${cronSecret}` },
      method: "POST",
    },
  );

  return response.ok;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StartFlowPayload;

    if (!payload.workspaceId || !payload.contactId || !payload.conversationId) {
      return NextResponse.json(
        { error: "workspaceId, contactId y conversationId son requeridos." },
        { status: 400 },
      );
    }

    const { user } = await requireWorkspaceRole(payload.workspaceId, [
      "owner",
      "admin",
      "agent",
    ]);
    const result = await startManualContactFlow({
      contactId: payload.contactId,
      conversationId: payload.conversationId,
      flowId: payload.flowId,
      startedBy: user.id,
      supabase: createAdminClient(),
      workspaceId: payload.workspaceId,
    });
    const delivered = await deliverFirstMessage(
      request,
      payload.workspaceId,
      payload.conversationId,
    );

    return NextResponse.json({ ...result, delivered });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
