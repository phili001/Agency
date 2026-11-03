import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { getContactCard, updateContact } from "@/lib/crm/contacts";
import { eraseContact } from "@/lib/crm/erasure";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ contactId: string }> };

/** Ficha completa del contacto (404 si no es de la empresa activa). */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent", "viewer"]);
    const { contactId } = await params;

    return NextResponse.json(await getContactCard(createAdminClient(), workspaceId, contactId));
  } catch (error) {
    return apiErrorResponse(error, "crm/contact:get");
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const contact = await updateContact(
      createAdminClient(),
      workspaceId,
      contactId,
      {
        company: body.company,
        customFields: body.customFields as Record<string, unknown> | undefined,
        email: body.email,
        fullName: body.fullName,
      },
      { kind: "operator", userId: user.id },
    );

    return NextResponse.json({ contact });
  } catch (error) {
    return apiErrorResponse(error, "crm/contact:patch");
  }
}

/** Borrado RGPD: todo lo del contacto, y sus eventos de Google a la cola. Solo owner/admin. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const { contactId } = await params;

    return NextResponse.json(await eraseContact(createAdminClient(), workspaceId, contactId));
  } catch (error) {
    return apiErrorResponse(error, "crm/contact:delete");
  }
}
