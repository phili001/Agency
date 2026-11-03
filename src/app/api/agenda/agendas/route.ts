import { NextResponse } from "next/server";

import { createAgenda, listAgendas, withoutConfig } from "@/lib/agenda/agendas";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveWorkspaceRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

/** Agendas de la empresa activa. Crear y configurar: owner/admin. */
export async function GET() {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin", "agent", "viewer"]);
    const agendas = await listAgendas(createAdminClient(), workspaceId);
    return NextResponse.json({ agendas: agendas.map(withoutConfig) });
  } catch (error) {
    return apiErrorResponse(error, "agenda/agendas:get");
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireActiveWorkspaceRole(["owner", "admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const agenda = await createAgenda(createAdminClient(), workspaceId, {
      ...body,
      name: body.name,
      timezone: body.timezone,
    });
    return NextResponse.json({ agenda: withoutConfig(agenda) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "agenda/agendas:post");
  }
}
