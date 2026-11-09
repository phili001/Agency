import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSessionCookie } from "@/lib/landing-route";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

function showLanding(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/inicio";
  return NextResponse.rewrite(url);
}

/**
 * En `/` la página por defecto es la landing. Solo quien tiene una sesión
 * válida ve el panel: una cookie caducada o de otra cuenta ya no lleva al login.
 */
export async function proxy(request: NextRequest) {
  const cookieNames = request.cookies.getAll().map(({ name }) => name);
  if (!hasSessionCookie(cookieNames)) return showLanding(request);

  const { supabaseAnonKey, supabaseUrl } = getSupabaseBrowserEnv();
  if (!supabaseUrl || !supabaseAnonKey) return showLanding(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Si la sesión se renueva, el panel y el navegador reciben las cookies nuevas.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return showLanding(request);
  } catch {
    return showLanding(request);
  }

  return response;
}

export const config = {
  matcher: "/",
};
