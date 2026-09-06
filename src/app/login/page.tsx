import { Bot, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { error, updated } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
      <div className="rounded-lg border border-[#d9ded3] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
            <Bot size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#647067]">Levy</p>
            <h1 className="text-xl font-semibold">Entrar</h1>
          </div>
        </div>

        {updated ? (
          <p className="mt-5 rounded-lg border border-[#cfe8b0] bg-[#e7f6ce] px-3 py-2 text-sm text-[#31521d]">
            Contraseña actualizada. Entra con la nueva.
          </p>
        ) : null}

        <form action={signIn} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="h-11 rounded-lg border border-[#cbd2c6] px-3 outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              name="email"
              placeholder="tu@email.com"
              required
              type="email"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Contraseña
            <input
              autoComplete="current-password"
              className="h-11 rounded-lg border border-[#cbd2c6] px-3 outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              name="password"
              placeholder="********"
              required
              type="password"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-4 text-sm font-semibold text-white">
            <LogIn size={17} />
            Entrar
          </button>
        </form>

        <Link
          className="mt-4 inline-block text-sm font-medium text-[#35735b] underline underline-offset-4"
          href="/recuperar"
        >
          ¿Olvidaste tu contraseña?
        </Link>

        <div className="mt-5 flex gap-2 rounded-lg bg-[#eef2eb] p-3 text-sm text-[#4d5a51]">
          <ShieldCheck className="mt-0.5 shrink-0 text-[#35735b]" size={17} />
          <p>
            Entra para gestionar tus empresas, agentes, números y equipo.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#d9ded3] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#d2f36b] text-[#10231c]">
            <Bot size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#647067]">Nuevo cliente</p>
            <h2 className="text-xl font-semibold">Acceso por invitación</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-lg bg-[#eef2eb] p-4 text-sm text-[#4d5a51]">
          <p>
            Tu cuenta debe ser creada o vinculada por un superadmin antes de entrar.
          </p>
          <p>
            Cuando recibas tu correo y contraseña temporal, entra desde el formulario
            de la izquierda y continuarás el onboarding de tu empresa.
          </p>
        </div>
      </div>
      </section>
    </main>
  );
}
