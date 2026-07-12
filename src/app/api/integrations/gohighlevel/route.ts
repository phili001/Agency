import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import { maskSecret, saveIntegrationSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { apiKey, locationId, workspaceId } = (await request.json()) as {
      apiKey?: string;
      locationId?: string;
      workspaceId?: string;
    };
    const cleanKey = apiKey?.trim();
    const cleanLocationId = locationId?.trim();

    if (!workspaceId || !cleanKey || !cleanLocationId) {
      return NextResponse.json(
        { error: "workspaceId, apiKey y locationId son requeridos." },
        { status: 400 },
      );
    }

    await requireWorkspaceRole(workspaceId);
    await saveIntegrationSecret({
      kind: "api_key",
      provider: "gohighlevel",
      value: cleanKey,
      workspaceId,
    });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("integrations")
      .upsert(
        {
          config: {
            api_key_mask: maskSecret(cleanKey),
            location_id: cleanLocationId,
          },
          connected_at: new Date().toISOString(),
          provider: "gohighlevel",
          status: "active",
          workspace_id: workspaceId,
        },
        { onConflict: "workspace_id,provider" },
      )
      .select("id, workspace_id, provider, status, config, secret_ref, last_error")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ integration: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
