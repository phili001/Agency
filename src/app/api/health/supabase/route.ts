import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export async function GET() {
  const { supabaseAnonKey, supabaseUrl } = getSupabaseBrowserEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_env",
        required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("workspaces").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: "supabase_query_failed",
        message: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Supabase REST is reachable. RLS is enabled, so data requires auth.",
  });
}
