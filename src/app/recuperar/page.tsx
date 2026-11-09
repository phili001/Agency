import type { Metadata } from "next";
import Link from "next/link";

import { brandButton, brandCard, brandError, brandInput, brandLink, brandNote, PublicShell } from "@/components/brand/public-shell";

import { requestPasswordReset } from "../login/actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <PublicShell>
      <section className={`${brandCard} my-auto w-full max-w-md`}>
        <h1 className="text-3xl font-extrabold tracking-tight">Recuperar contraseña</h1>

        {sent ? (
          <div className="mt-6 grid gap-4">
            <p className={`${brandNote} text-sm leading-6`}>
              Si ese email tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.
            </p>
            <Link className={brandButton} href="/login">
              Volver a entrar
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 leading-7 text-muted">Escribe el email de tu cuenta y te enviamos un enlace para crear una contraseña nueva.</p>

            <form action={requestPasswordReset} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold">
                Email
                <input autoComplete="email" className={brandInput} name="email" placeholder="tu@email.com" required type="email" />
              </label>

              {error ? <p className={brandError}>{error}</p> : null}

              <button className={brandButton}>Enviar enlace</button>
            </form>

            <Link className={`${brandLink} mt-5 inline-block text-sm`} href="/login">
              Volver a entrar
            </Link>
          </>
        )}
      </section>
    </PublicShell>
  );
}
