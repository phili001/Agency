import { createClient } from "@supabase/supabase-js";

import { assertSupabaseAdminEnv } from "./env";

export function createAdminClient() {
  const { supabaseServiceRoleKey, supabaseUrl } = assertSupabaseAdminEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
