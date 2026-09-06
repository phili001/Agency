import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Punto de aterrizaje de los enlaces que manda Supabase (recuperar contraseña,
 * invitaciones). Canjea el codigo por una sesion aqui, en un route handler, que
 * es donde si se pueden escribir las cookies de sesion.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  // Solo rutas internas: un "next" absoluto permitiria redirigir a otro dominio.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/recuperar?error=${encodeURIComponent(
          "El enlace no es válido. Pide uno nuevo.",
        )}`,
        url.origin,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/recuperar?error=${encodeURIComponent(
          "El enlace caducó o ya se usó. Pide uno nuevo.",
        )}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
