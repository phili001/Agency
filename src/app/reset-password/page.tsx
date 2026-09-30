import { Bot, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { updatePassword } from "../login/actions";
import { createClient } from "@/lib/supabase/server";

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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
            <Bot size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#647067]">Levy</p>
            <h1 className="text-xl font-semibold">
              {isWelcome ? "Crea tu contraseña" : "Nueva contraseña"}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-[#647067]">
          {isWelcome ? (
            <>
              Bienvenido a Levy. Crea la contraseña con la que vas a entrar como{" "}
              <strong>{user.email}</strong>. Después te llevamos a la configuración guiada.
            </>
          ) : (
            <>
              Estás cambiando la contraseña de <strong>{user.email}</strong>.
            </>
          )}
        </p>

        <form action={updatePassword} className="mt-5 grid gap-4">
          {isWelcome ? <input name="bienvenida" type="hidden" value="1" /> : null}
          <label className="grid gap-1.5 text-sm font-medium">
            {isWelcome ? "Tu contraseña" : "Contraseña nueva"}
            <input
              autoComplete="new-password"
              className="h-11 rounded-lg border border-[#cbd2c6] px-3 outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              minLength={8}
              name="password"
              placeholder="Mínimo 8 caracteres"
              required
              type="password"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Repite la contraseña
            <input
              autoComplete="new-password"
              className="h-11 rounded-lg border border-[#cbd2c6] px-3 outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50"
              minLength={8}
              name="confirmation"
              placeholder="Mínimo 8 caracteres"
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
            <KeyRound size={17} />
            {isWelcome ? "Crear contraseña y entrar" : "Guardar contraseña"}
          </button>
        </form>

        {!isWelcome ? (
          <Link
            className="mt-4 inline-block text-sm font-medium text-[#35735b] underline underline-offset-4"
            href="/login"
          >
            Cancelar
          </Link>
        ) : null}
      </section>
    </main>
  );
}
