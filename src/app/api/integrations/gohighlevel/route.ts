import { NextResponse } from "next/server";

import { normalizeAppUrl } from "@/lib/app-url";
import { requireWorkspaceRole } from "@/lib/authz";
import {
  generateWebhookSecret,
  getIntegrationSecret,
  hashSecret,
  maskSecret,
  saveIntegrationSecret,
} from "@/lib/integrations/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

function webhookUrl() {
  return `${normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)}/api/webhooks/ghl/send-message`;
}

export async function POST(request: Request) {
  try {
    const { apiKey, calendarId, locationId, regenerateWebhookSecret, workspaceId } =
      (await request.json()) as {
        apiKey?: string;
        calendarId?: string;
        locationId?: string;
        regenerateWebhookSecret?: boolean;
        workspaceId?: string;
      };
    const cleanKey = apiKey?.trim();
    const cleanLocationId = locationId?.trim();

    if (!workspaceId || !cleanLocationId) {
      return NextResponse.json(
        { error: "workspaceId y locationId son requeridos." },
        { status: 400 },
      );
    }

    await requireWorkspaceRole(workspaceId);

    const storedKey = await getIntegrationSecret({
      kind: "api_key",
      provider: "gohighlevel",
      workspaceId,
    });

    if (!cleanKey && !storedKey) {
      return NextResponse.json(
        { error: "Pega la API key de GoHighLevel para conectar la integracion." },
        { status: 400 },
      );
    }

    if (cleanKey) {
      await saveIntegrationSecret({
        kind: "api_key",
        provider: "gohighlevel",
        value: cleanKey,
        workspaceId,
      });
    }

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
    const existingHash =
      typeof existingConfig.ghl_webhook_secret_hash === "string"
        ? existingConfig.ghl_webhook_secret_hash
        : "";
    // El secreto solo se guarda hasheado, asi que solo puede mostrarse en el
    // momento en que se genera: al conectar por primera vez o al regenerar.
    const generatedSecret =
      regenerateWebhookSecret || !existingHash ? generateWebhookSecret() : null;
    const { data, error } = await admin
      .from("integrations")
      .upsert(
        {
          // Config completa y explicita: los mapas JSON (stage_map, tag_map,
          // custom_field_map) no tenian consumidor y se descartan al reescribir.
          config: {
            api_key_mask: cleanKey
              ? maskSecret(cleanKey)
              : (existingConfig.api_key_mask ?? maskSecret(storedKey)),
            calendar_id: calendarId?.trim() ?? existingConfig.calendar_id ?? "",
            default_pipeline_id: existingConfig.default_pipeline_id ?? "",
            default_stage_id: existingConfig.default_stage_id ?? "",
            ghl_webhook_secret_hash: generatedSecret
              ? hashSecret(generatedSecret)
              : existingHash,
            ghl_webhook_secret_mask: generatedSecret
              ? maskSecret(generatedSecret)
              : (existingConfig.ghl_webhook_secret_mask ?? null),
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

    return NextResponse.json({
      integration: data,
      webhookSecret: generatedSecret ?? undefined,
      webhookUrl: webhookUrl(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}
