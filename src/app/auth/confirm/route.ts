import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Enlaces que generamos desde el servidor (el acceso que se manda tras pagar
 * Levy). A diferencia de /auth/callback, no traen `code`: traen el token_hash
 * de Supabase y se canjea con verifyOtp. Asi el enlace funciona aunque se abra
 * en otro navegador o en el movil, porque no depende de nada guardado antes.
 */
const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "invite", "magiclink"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/";
  // Solo rutas internas: un "next" absoluto permitiria redirigir a otro dominio.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(
      new URL(
        `/recuperar?error=${encodeURIComponent("El enlace no es válido. Pide uno nuevo.")}`,
        url.origin,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/recuperar?error=${encodeURIComponent(
          "El enlace caducó o ya se usó. Escribe tu correo y te mandamos uno nuevo.",
        )}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
