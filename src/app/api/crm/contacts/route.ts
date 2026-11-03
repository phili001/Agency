import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createContact, searchContacts } from "@/lib/crm/contacts";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lista de contactos de la empresa activa: búsqueda, filtros y página. */
export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent", "viewer"]);
    const params = new URL(request.url).searchParams;

    return NextResponse.json(
      await searchContacts(createAdminClient(), workspaceId, {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 25),
        query: params.get("q"),
        source: params.get("source") || null,
        stageId: params.get("stageId") || null,
        tagId: params.get("tagId") || null,
      }),
    );
  } catch (error) {
    return apiErrorResponse(error, "crm/contacts:get");
  }
}

export async function POST(request: Request) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const body = (await request.json()) as Record<string, unknown>;
    const contact = await createContact(
      createAdminClient(),
      workspaceId,
      {
        company: body.company,
        customFields: body.customFields as Record<string, unknown> | undefined,
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        source: "manual",
        stageId: typeof body.stageId === "string" ? body.stageId : null,
      },
      { kind: "operator", userId: user.id },
    );

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "crm/contacts:post");
  }
}
