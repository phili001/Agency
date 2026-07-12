import { NextResponse } from "next/server";

import { createCompanyWithOwner } from "@/lib/admin-companies";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requirePlatformAdmin(user);

    const { companyName, ownerEmail, temporaryPassword } = (await request.json()) as {
      companyName?: string;
      ownerEmail?: string;
      temporaryPassword?: string;
    };
    const result = await createCompanyWithOwner({
      companyName: companyName ?? "",
      ownerEmail: ownerEmail ?? "",
      temporaryPassword: temporaryPassword ?? "",
    });

    return NextResponse.json({
      ownerEmail: result.owner.email,
      workspace: result.workspace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 403 },
    );
  }
}
