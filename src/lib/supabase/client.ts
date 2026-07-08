"use client";

import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseBrowserEnv } from "./env";

export function createClient() {
  const { supabaseAnonKey, supabaseUrl } = assertSupabaseBrowserEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
