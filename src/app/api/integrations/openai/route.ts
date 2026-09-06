import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { saveIntegrationSecret, maskSecret } from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { apiKey, defaultModel, workspaceId } = (await request.json()) as {
      apiKey?: string;
      defaultModel?: string;
      workspaceId?: string;
    };
    const cleanKey = apiKey?.trim();

    if (!workspaceId || !cleanKey) {
      return NextResponse.json(
        { error: "workspaceId y apiKey son requeridos." },
        { status: 400 },
      );
    }

    await requireWorkspaceRole(workspaceId);
    await saveIntegrationSecret({
      kind: "api_key",
      provider: "openai",
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
            default_model: defaultModel?.trim() || "gpt-5.4-mini",
          },
          connected_at: new Date().toISOString(),
          provider: "openai",
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
    return apiErrorResponse(error, "integrations/openai");
  }
}
