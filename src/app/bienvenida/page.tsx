import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Image from "next/image";

import { WelcomeAutoRefresh, WelcomeResendButton } from "@/components/billing/welcome-actions";
import { findAuthUserByEmail } from "@/lib/admin-companies";
import { getBillingConfig } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { getWelcomeState, isCheckoutSessionId, type WelcomeState } from "@/lib/billing/welcome-page";
import { createAdminClient } from "@/lib/supabase/admin";

// Mismo aspecto que la landing (activa.agentelevi.com). La fuente la sirve la app.
const figtree = Figtree({ subsets: ["latin"] });

export const metadata: Metadata = {
  // La URL lleva el id de la sesión de pago: que no salga hacia otros sitios.
  referrer: "no-referrer",
  title: "Bienvenida",
};

async function loadState(sessionId: unknown): Promise<WelcomeState | { status: "unavailable" }> {
  if (!isCheckoutSessionId(sessionId)) return { status: "not_found" };

  try {
    const admin = createAdminClient();
    return await getWelcomeState(sessionId, {
      client: admin,
      config: getBillingConfig(),
      findUserIdByEmail: async (email) => (await findAuthUserByEmail(admin, email))?.id ?? null,
      stripe: getStripe(),
    });
  } catch (error) {
    console.error(`[bienvenida] no se pudo leer el pago: ${error instanceof Error ? error.message : "error"}`);
    return { status: "unavailable" };
  }
}

const contact = (
  <a className="font-semibold text-[#111111] underline" href="mailto:hola@agentelevi.com">
    hola@agentelevi.com
  </a>
);

function WelcomeContent({ sessionId, state }: { sessionId: string; state: Awaited<ReturnType<typeof loadState>> }) {
  switch (state.status) {
    case "ready":
      return (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">Ya está. Te damos la bienvenida a Levy.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#4A4943]">
            Te enviamos el acceso a <strong className="[overflow-wrap:anywhere] text-[#111111]">{state.email}</strong>.
          </p>
          <p className="mt-2 leading-7 text-[#6B6A63]">
            Abre el correo y elige tu contraseña. Si no lo ves en un par de minutos, mira en spam.
          </p>
          <WelcomeResendButton sessionId={sessionId} />
        </>
      );
    case "preparing":
      return (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">Estamos preparando tu cuenta.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#4A4943]">
            Tu pago ha llegado bien. En unos segundos te enviamos el acceso a{" "}
            <strong className="[overflow-wrap:anywhere] text-[#111111]">{state.email}</strong>.
          </p>
          <WelcomeAutoRefresh />
        </>
      );
    case "pending":
      return (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">Tu pago se está confirmando.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#4A4943]">
            En cuanto se confirme te enviamos el acceso por correo. No tienes que hacer nada más.
          </p>
        </>
      );
    case "unavailable":
      return (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">No hemos podido comprobar tu pago.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#4A4943]">
            Prueba a recargar esta página en un momento. Si ya has pagado, el acceso te llega igualmente por correo. Si no, escríbenos
            a {contact}.
          </p>
        </>
      );
    default:
      return (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">No encontramos este pago.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#4A4943]">
            Revisa el enlace. Si ya has pagado, busca nuestro correo con el acceso o escríbenos a {contact}.
          </p>
        </>
      );
  }
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const { session_id: sessionId } = await searchParams;
  const state = await loadState(sessionId);

  return (
    <main className={`${figtree.className} min-h-screen bg-[#F7F6F1] px-5 py-10 text-[#111111]`}>
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2.5 text-xl font-extrabold">
          <Image alt="" height={40} priority src="/levy-logo.png" width={38} />
          Levy
        </div>
        <section className="mt-8 rounded-2xl border border-[#D9D7CF] bg-white p-7 sm:p-9">
          <WelcomeContent sessionId={typeof sessionId === "string" ? sessionId : ""} state={state} />
        </section>
      </div>
    </main>
  );
}
