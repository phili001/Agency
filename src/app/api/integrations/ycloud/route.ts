import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireWorkspaceRole } from "@/lib/authz";
import { normalizeAppUrl } from "@/lib/app-url";
import {
  generateWebhookSecret,
  getIntegrationSecret,
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
        { error: "workspaceId, apiKey y número son requeridos." },
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

    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

    return NextResponse.json({
      integration: data,
      webhookSecret: secret,
      webhookUrl: `${appUrl}/api/webhooks/ycloud/${companyCode}/${encodeURIComponent(secret)}`,
    });
  } catch (error) {
    return apiErrorResponse(error, "integrations/ycloud");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requerido." }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId);

    const admin = createAdminClient();
    const [{ data: workspace }, webhookSecret] = await Promise.all([
      admin.from("workspaces").select("id, company_code").eq("id", workspaceId).single(),
      getIntegrationSecret({
        kind: "webhook_secret",
        provider: "ycloud",
        workspaceId,
      }),
    ]);

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Guarda YCloud para generar un secreto único." },
        { status: 404 },
      );
    }

    const companyCode =
      workspace && "company_code" in workspace && typeof workspace.company_code === "string"
        ? workspace.company_code
        : workspaceId;
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

    return NextResponse.json({
      webhookSecret,
      webhookUrl: `${appUrl}/api/webhooks/ycloud/${companyCode}/${encodeURIComponent(webhookSecret)}`,
    });
  } catch (error) {
    return apiErrorResponse(error, "integrations/ycloud");
  }
}
