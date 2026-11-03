import { NextResponse } from "next/server";

import { requireUser } from "@/lib/authz";
import { callbackRedirectPath, completeGoogleCallback } from "@/lib/integrations/google-calendar-callback";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vuelta de Google. Siempre redirige al panel (Integraciones) con el resultado:
 * es una navegación del navegador, no una llamada de la app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  let userId: string;

  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const result = await completeGoogleCallback(
    createAdminClient(),
    {
      code: url.searchParams.get("code"),
      error: url.searchParams.get("error"),
      state: url.searchParams.get("state"),
    },
    userId,
  );

  return NextResponse.redirect(new URL(callbackRedirectPath(result), url.origin));
}
