import { Bot, MailCheck, SendHorizonal } from "lucide-react";
import Link from "next/link";

import { requestPasswordReset } from "../login/actions";

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
            <Bot size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#647067]">Levy</p>
            <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
          </div>
        </div>

        {sent ? (
          <div className="mt-6 grid gap-3">
            <div className="flex gap-2 rounded-lg bg-[#e7f6ce] p-4 text-sm text-[#31521d]">
              <MailCheck className="mt-0.5 shrink-0" size={18} />
              <p>
                Si ese email tiene una cuenta, te enviamos un enlace para crear una
                contraseña nueva. Revisa también la carpeta de spam.
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cbd2c6] px-4 text-sm font-semibold"
              href="/login"
            >
              Volver a entrar
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-[#647067]">
              Escribe el email de tu cuenta y te enviamos un enlace para crear una
              contraseña nueva.
            </p>

            <form action={requestPasswordReset} className="mt-5 grid gap-4">
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

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-4 text-sm font-semibold text-white">
                <SendHorizonal size={17} />
                Enviar enlace
              </button>
            </form>

            <Link
              className="mt-4 inline-block text-sm font-medium text-[#35735b] underline underline-offset-4"
              href="/login"
            >
              Volver a entrar
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
