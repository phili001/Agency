import { Bot, LogIn, ShieldCheck } from "lucide-react";

import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
            <Bot size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#647067]">WhatsApp SaaS</p>
            <h1 className="text-xl font-semibold">Entrar al dashboard</h1>
          </div>
        </div>

        <form action={signIn} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <input
              className="h-11 rounded-lg border border-[#cbd2c6] px-3 outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              name="email"
              placeholder="tu@email.com"
              required
              type="email"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <input
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

        <div className="mt-5 flex gap-2 rounded-lg bg-[#eef2eb] p-3 text-sm text-[#4d5a51]">
          <ShieldCheck className="mt-0.5 shrink-0 text-[#35735b]" size={17} />
          <p>
            Usa el usuario que creaste en Supabase Auth. Los datos del dashboard
            se filtran por tu workspace con RLS.
          </p>
        </div>
      </section>
    </main>
  );
}
