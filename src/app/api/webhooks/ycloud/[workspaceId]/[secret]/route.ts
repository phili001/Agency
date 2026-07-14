import { NextResponse } from "next/server";

import { handleYCloudWebhook } from "@/lib/ycloud-webhook";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string; workspaceId: string }> },
) {
  const { secret, workspaceId } = await params;

  return handleYCloudWebhook(request, workspaceId, decodeURIComponent(secret));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ secret: string; workspaceId: string }> },
) {
  const { workspaceId } = await params;

  return NextResponse.json({
    companyCode: workspaceId,
    ok: true,
    provider: "ycloud",
    usage: "/api/webhooks/ycloud/AAA001/secret",
    workspaceId,
  });
}
