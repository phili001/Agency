import { NextResponse } from "next/server";

import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { addTagToContact, removeTagFromContact } from "@/lib/crm/tags";
import { triggerDeliver } from "@/lib/deliver-trigger";
import { startTagFlows } from "@/lib/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ contactId: string }> };

/**
 * Pone una etiqueta. Si el contacto no la tenía, arranca los flujos con
 * trigger `tag` y pide a `deliver` que mande lo que hayan encolado.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const { tagId } = (await request.json()) as { tagId?: string };

    if (!tagId) {
      throw badRequest("Falta la etiqueta.");
    }

    const admin = createAdminClient();
    const result = await addTagToContact(admin, workspaceId, contactId, tagId, { kind: "operator", userId: user.id });
    const started = result.added
      ? await startTagFlows({ contactId, supabase: admin, tagIds: [tagId], workspaceId })
      : [];

    if (started.length > 0) {
      await triggerDeliver(
        new URL(request.url).origin,
        started.map((item) => ({ conversationId: item.conversationId, workspaceId })),
      );
    }

    return NextResponse.json({ ...result, flowsStarted: started.length });
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/tags:post");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { user, workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const { contactId } = await params;
    const tagId = new URL(request.url).searchParams.get("tagId");

    if (!tagId) {
      throw badRequest("Falta la etiqueta.");
    }

    return NextResponse.json(
      await removeTagFromContact(createAdminClient(), workspaceId, contactId, tagId, { kind: "operator", userId: user.id }),
    );
  } catch (error) {
    return apiErrorResponse(error, "crm/contact/tags:delete");
  }
}
