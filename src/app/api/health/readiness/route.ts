import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

type Check = {
  detail?: string;
  name: string;
  ok: boolean;
  severity: "required" | "recommended";
};

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INTEGRATION_ENCRYPTION_KEY",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

const recommendedEnv: string[] = [];

const requiredTables = [
  "workspaces",
  "workspace_members",
  "contacts",
  "agents",
  "conversations",
  "messages",
  "integrations",
  "usage_events",
];

const incrementalTables = ["workspace_assets", "webhook_events", "integration_secrets"];

async function tableCheck(
  supabase: SupabaseClient | null,
  table: string,
): Promise<Check> {
  if (!supabase) {
    return {
      detail: "Admin Supabase client is not available.",
      name: `table:${table}`,
      ok: false,
      severity: "required",
    };
  }

  try {
    const { error } = await supabase.from(table).select("id").limit(1);

    return {
      detail: error?.message,
      name: `table:${table}`,
      ok: !error,
      severity: "required",
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : "Unknown error",
      name: `table:${table}`,
      ok: false,
      severity: "required",
    };
  }
}

function envCheck(key: string, severity: Check["severity"]): Check {
  return {
    name: `env:${key}`,
    ok: Boolean(process.env[key]),
    severity,
  };
}

export async function GET() {
  let supabase: SupabaseClient | null = null;

  try {
    supabase = createAdminClient();
  } catch {
    supabase = null;
  }

  const envChecks = [
    ...requiredEnv.map((key) => envCheck(key, "required")),
    ...recommendedEnv.map((key) => envCheck(key, "recommended")),
  ];
  const tableChecks = await Promise.all(
    [...requiredTables, ...incrementalTables].map((table) =>
      tableCheck(supabase, table),
    ),
  );
  const checks = [...envChecks, ...tableChecks];
  const requiredOk = checks
    .filter((check) => check.severity === "required")
    .every((check) => check.ok);
  const recommendedOk = checks
    .filter((check) => check.severity === "recommended")
    .every((check) => check.ok);

  return NextResponse.json(
    {
      checks,
      ok: requiredOk,
      productionReady: requiredOk && recommendedOk,
      routes: {
        bufferCron: "/api/cron/buffer",
        deliverCron: "/api/cron/deliver",
        ghlSyncCron: "/api/cron/ghl-sync",
        supabaseHealth: "/api/health/supabase",
        ycloudWebhook: "/api/webhooks/ycloud/AAA001/secret",
      },
    },
    { status: requiredOk ? 200 : 503 },
  );
}
