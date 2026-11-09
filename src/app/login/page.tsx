import type { Metadata } from "next";
import Link from "next/link";

import { brandButton, brandCard, brandError, brandInput, brandLink, PublicShell } from "@/components/brand/public-shell";

import { signIn } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { error, updated } = await searchParams;

  return (
    <PublicShell>
      <section className={`${brandCard} my-auto w-full max-w-md`}>
        <h1 className="text-3xl font-extrabold tracking-tight">Entrar</h1>
        <p className="mt-2 leading-7 text-muted">Gestiona tus agentes, tus números y tu equipo.</p>

        {updated ? (
          <p className="mt-5 rounded-xl border-[1.5px] border-ink bg-yellow-soft px-3 py-2 text-sm">Contraseña actualizada. Entra con la nueva.</p>
        ) : null}

        <form action={signIn} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-bold">
            Email
            <input autoComplete="email" className={brandInput} name="email" placeholder="tu@email.com" required type="email" />
          </label>

          <label className="grid gap-1.5 text-sm font-bold">
            Contraseña
            <input autoComplete="current-password" className={brandInput} name="password" placeholder="********" required type="password" />
          </label>

          {error ? <p className={brandError}>{error}</p> : null}

          <button className={brandButton}>Entrar</button>
        </form>

        <Link className={`${brandLink} mt-5 inline-block text-sm`} href="/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>

        <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-muted">
          ¿Aún no tienes Levy?{" "}
          <Link className={brandLink} href="/">
            Mira cómo funciona
          </Link>
        </p>
      </section>
    </PublicShell>
  );
}
