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
    const {
      apiKey,
      customFieldMap,
      defaultPipelineId,
      defaultStageId,
      ghlWebhookSecret,
      locationId,
      stageMap,
      tagMap,
      workspaceId,
    } = (await request.json()) as {
      apiKey?: string;
      customFieldMap?: string;
      defaultPipelineId?: string;
      defaultStageId?: string;
      ghlWebhookSecret?: string;
      locationId?: string;
      stageMap?: string;
      tagMap?: string;
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
    const { data: existingIntegration } = await admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gohighlevel")
      .maybeSingle();
    const existingConfig =
      existingIntegration?.config &&
      typeof existingIntegration.config === "object" &&
      !Array.isArray(existingIntegration.config)
        ? (existingIntegration.config as Record<string, unknown>)
        : {};
    const incomingSecret = ghlWebhookSecret?.trim();
    const generatedSecret =
      incomingSecret || existingConfig.ghl_webhook_secret_hash
        ? incomingSecret
        : generateWebhookSecret();
    const webhookSecretHash = generatedSecret
      ? hashSecret(generatedSecret)
      : String(existingConfig.ghl_webhook_secret_hash ?? "");
    const webhookSecretMask = generatedSecret
      ? maskSecret(generatedSecret)
      : String(existingConfig.ghl_webhook_secret_mask ?? "");
    const { data, error } = await admin
      .from("integrations")
      .upsert(
        {
          config: {
            api_key_mask: maskSecret(cleanKey),
            custom_field_map: customFieldMap?.trim() ?? "",
            default_pipeline_id: defaultPipelineId?.trim() ?? "",
            default_stage_id: defaultStageId?.trim() ?? "",
            ghl_webhook_secret_hash: webhookSecretHash,
            ghl_webhook_secret_mask: webhookSecretMask,
            location_id: cleanLocationId,
            stage_map: stageMap?.trim() ?? "",
            tag_map: tagMap?.trim() ?? "",
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

    return NextResponse.json({
      integration: data,
      webhookSecret: generatedSecret || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
