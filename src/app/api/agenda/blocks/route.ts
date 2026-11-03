import { NextResponse } from "next/server";

import { createBlock } from "@/lib/agenda/appointments";
import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

/** Bloquear un tramo (comida, vacaciones, un curso): no se ofrecen huecos ahí. */
export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent"]);
    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.agendaId !== "string") {
      throw badRequest("Elige la agenda.");
    }

    const block = await createBlock(createAdminClient(), workspaceId, {
      agendaId: body.agendaId,
      endsAt: String(body.endsAt ?? ""),
      reason: typeof body.reason === "string" ? body.reason : null,
      startsAt: String(body.startsAt ?? ""),
    });
    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "agenda/blocks:post");
  }
}
