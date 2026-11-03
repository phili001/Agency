import { NextResponse } from "next/server";

import { runCrmJobs } from "@/lib/agenda/crm-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Trabajos del CRM cada 5 minutos (ver `src/lib/agenda/crm-jobs.ts`). Lo llama
 * pg_cron + pg_net con `Authorization: Bearer <CRON_SECRET>` (F4.3). No acepta
 * el secreto por query: quedaría en los logs de acceso.
 */
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
}

async function triggerDeliver(origin: string, targets: Array<{ conversationId: string; workspaceId: string }>) {
  const cronSecret = process.env.CRON_SECRET;

  for (const { conversationId, workspaceId } of targets.slice(0, 50)) {
    const query = new URLSearchParams({ conversationId, workspaceId });
    await fetch(`${origin}/api/cron/deliver?${query.toString()}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      method: "POST",
    }).catch((error) => console.error("[crm-jobs:deliver]", conversationId, error));
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const report = await runCrmJobs(createAdminClient(), {
    deliver: (targets) => triggerDeliver(origin, targets),
  });
  const failed = Object.values(report.steps).some((step) => step && !step.ok);

  return NextResponse.json(report, { status: failed ? 500 : 200 });
}

export async function GET(request: Request) {
  return POST(request);
}
