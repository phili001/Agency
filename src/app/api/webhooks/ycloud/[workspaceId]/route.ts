import { NextResponse } from "next/server";

import { handleYCloudWebhook } from "@/lib/ycloud-webhook";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  return handleYCloudWebhook(request, workspaceId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
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
