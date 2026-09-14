import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { resumeDueFlowRuns } from "@/lib/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");

  return Boolean(
    cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret),
  );
}

async function deliverQueuedMessages(
  request: Request,
  results: Array<{ conversationId?: string | null; workspaceId?: string }>,
) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return 0;
  }

  const origin = new URL(request.url).origin;
  const targets = new Map<string, { conversationId: string; workspaceId: string }>();

  for (const result of results) {
    if (result.conversationId && result.workspaceId) {
      targets.set(result.conversationId, {
        conversationId: result.conversationId,
        workspaceId: result.workspaceId,
      });
    }
  }

  let delivered = 0;

  for (const target of targets.values()) {
    const query = new URLSearchParams(target);
    const response = await fetch(`${origin}/api/cron/deliver?${query}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      method: "POST",
    }).catch(() => null);

    if (response?.ok) {
      delivered += 1;
    }
  }

  return delivered;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Cron no autorizado." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const workspaceId = params.get("workspaceId");

  try {
    const results = await resumeDueFlowRuns({
      supabase: createAdminClient(),
      workspaceId,
    });

    // Los pasos reanudados dejan mensajes en cola. Se entregan aqui mismo:
    // esperar al cron de deliver los retrasaria hasta un dia en plan Hobby.
    const delivered = await deliverQueuedMessages(request, results);

    return NextResponse.json({ delivered, processed: results.length, results });
  } catch (error) {
    return apiErrorResponse(error, "cron/flows");
  }
}

export async function GET(request: Request) {
  return POST(request);
}
