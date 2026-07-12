import { NextResponse } from "next/server";

import { requireWorkspaceRole } from "@/lib/authz";
import {
  generateWebhookSecret,
  hashSecret,
  maskSecret,
  saveIntegrationSecret,
} from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { apiKey, phoneE164, phoneId, wabaId, webhookSecret, workspaceId } =
      (await request.json()) as {
        apiKey?: string;
        phoneE164?: string;
        phoneId?: string;
        wabaId?: string;
        webhookSecret?: string;
        workspaceId?: string;
      };
    const cleanKey = apiKey?.trim();
    const cleanPhone = phoneE164?.trim();

    if (!workspaceId || !cleanKey || !cleanPhone) {
      return NextResponse.json(
        { error: "workspaceId, apiKey y numero son requeridos." },
        { status: 400 },
      );
    }

    await requireWorkspaceRole(workspaceId);
    const secret = webhookSecret?.trim() || generateWebhookSecret();
    const admin = createAdminClient();
    const { data: workspace } = await admin
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();
    const companyCode =
      workspace && "company_code" in workspace && typeof workspace.company_code === "string"
        ? workspace.company_code
        : workspaceId;

    await Promise.all([
      saveIntegrationSecret({
        kind: "api_key",
        provider: "ycloud",
        value: cleanKey,
        workspaceId,
      }),
      saveIntegrationSecret({
        kind: "webhook_secret",
        provider: "ycloud",
        value: secret,
        workspaceId,
      }),
    ]);

    const { data, error } = await admin
      .from("integrations")
      .upsert(
        {
          config: {
            api_key_mask: maskSecret(cleanKey),
            phone_e164: cleanPhone,
            phone_id: phoneId?.trim() || null,
            waba_id: wabaId?.trim() || null,
            webhook_secret_hash: hashSecret(secret),
          },
          connected_at: new Date().toISOString(),
          provider: "ycloud",
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return NextResponse.json({
      integration: data,
      webhookSecret: secret,
      webhookUrl: `${appUrl.replace(/\/$/, "")}/api/webhooks/ycloud/${companyCode}?secret=${encodeURIComponent(secret)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
