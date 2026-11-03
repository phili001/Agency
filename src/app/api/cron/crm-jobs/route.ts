import { NextResponse } from "next/server";

import { runCrmJobs } from "@/lib/agenda/crm-jobs";
import { listBlockedWorkspaceIds } from "@/lib/billing/workspace-billing";
import { triggerDeliver } from "@/lib/deliver-trigger";
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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const report = await runCrmJobs(createAdminClient(), {
    // Empresas bloqueadas por impago: sin recordatorios ni avisos (F6.4).
    billing: async (client, now) => ({ blockedWorkspaceIds: await listBlockedWorkspaceIds(client, { now }) }),
    deliver: (targets) => triggerDeliver(origin, targets),
  });
  const failed = Object.values(report.steps).some((step) => step && !step.ok);

  return NextResponse.json(report, { status: failed ? 500 : 200 });
}

export async function GET(request: Request) {
  return POST(request);
}
