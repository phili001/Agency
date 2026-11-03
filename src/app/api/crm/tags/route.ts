import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createTag } from "@/lib/crm/tags";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const tag = await createTag(createAdminClient(), workspaceId, { color: body.color, name: body.name });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/tags:post");
  }
}
