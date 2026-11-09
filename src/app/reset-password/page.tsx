import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { brandButton, brandCard, brandError, brandInput, brandLink, PublicShell } from "@/components/brand/public-shell";
import { createClient } from "@/lib/supabase/server";

import { updatePassword } from "../login/actions";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string; error?: string }>;
}) {
  const { bienvenida, error } = await searchParams;
  // Cliente nuevo que llega desde el correo de acceso tras pagar: no tiene una
  // contraseña que "cambiar", la esta creando por primera vez.
  const isWelcome = bienvenida === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se llega aqui con la sesion temporal que abre el enlace de recuperacion.
  // Sin sesion no hay nada que cambiar: se manda a pedir otro enlace.
  if (!user) {
    redirect(
      `/recuperar?error=${encodeURIComponent(
        "El enlace caducó o ya se usó. Pide uno nuevo.",
      )}`,
    );
  }

  return (
    <PublicShell>
      <section className={`${brandCard} my-auto w-full max-w-md`}>
        <h1 className="text-3xl font-extrabold tracking-tight">{isWelcome ? "Crea tu contraseña" : "Nueva contraseña"}</h1>

        <p className="mt-2 leading-7 text-muted">
          {isWelcome ? (
            <>
              Bienvenido a Levy. Crea la contraseña con la que vas a entrar como <strong className="[overflow-wrap:anywhere] text-ink">{user.email}</strong>. Después te llevamos a la configuración guiada.
            </>
          ) : (
            <>
              Estás cambiando la contraseña de <strong className="[overflow-wrap:anywhere] text-ink">{user.email}</strong>.
            </>
          )}
        </p>

        <form action={updatePassword} className="mt-6 grid gap-4">
          {isWelcome ? <input name="bienvenida" type="hidden" value="1" /> : null}
          <label className="grid gap-1.5 text-sm font-bold">
            {isWelcome ? "Tu contraseña" : "Contraseña nueva"}
            <input autoComplete="new-password" className={brandInput} minLength={8} name="password" placeholder="Mínimo 8 caracteres" required type="password" />
          </label>

          <label className="grid gap-1.5 text-sm font-bold">
            Repite la contraseña
            <input autoComplete="new-password" className={brandInput} minLength={8} name="confirmation" placeholder="Mínimo 8 caracteres" required type="password" />
          </label>

          {error ? <p className={brandError}>{error}</p> : null}

          <button className={brandButton}>{isWelcome ? "Crear contraseña y entrar" : "Guardar contraseña"}</button>
        </form>

        {!isWelcome ? (
          <Link className={`${brandLink} mt-5 inline-block text-sm`} href="/login">
            Cancelar
          </Link>
        ) : null}
      </section>
    </PublicShell>
  );
}
