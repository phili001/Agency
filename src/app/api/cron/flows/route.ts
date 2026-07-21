import { NextResponse } from "next/server";

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

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
