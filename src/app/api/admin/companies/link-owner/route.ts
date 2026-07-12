import { NextResponse } from "next/server";

import { linkOwnerToWorkspace } from "@/lib/admin-companies";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requirePlatformAdmin(user);

    const { ownerEmail, temporaryPassword, workspaceId } = (await request.json()) as {
      ownerEmail?: string;
      temporaryPassword?: string;
      workspaceId?: string;
    };
    const owner = await linkOwnerToWorkspace({
      ownerEmail: ownerEmail ?? "",
      temporaryPassword,
      workspaceId: workspaceId ?? "",
    });

    return NextResponse.json({ ownerEmail: owner.email, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 403 },
    );
  }
}
