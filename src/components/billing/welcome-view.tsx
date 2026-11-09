import { WelcomeAutoRefresh, WelcomeResendButton } from "@/components/billing/welcome-actions";
import { brandCard, brandEyebrow, brandLink, brandNote } from "@/components/brand/public-shell";
import type { WelcomeState } from "@/lib/billing/welcome-page";

export type WelcomeViewState = WelcomeState | { status: "unavailable" };

const contact = (
  <a className={brandLink} href="mailto:hola@agentelevi.com">
    hola@agentelevi.com
  </a>
);

const preparation = [
  {
    body: "Es la que escribe las respuestas. Con unos 5 $ de saldo basta para empezar.",
    href: "https://platform.openai.com",
    linkLabel: "Abrir OpenAI",
    title: "Tu cuenta de OpenAI con saldo",
  },
  {
    body: "Es donde vive tu número de WhatsApp Business. Si aún no la tienes, la creamos juntos.",
    href: "https://www.ycloud.com",
    linkLabel: "Abrir YCloud",
    title: "Tu cuenta de YCloud",
  },
  {
    body: "Servicios con precios, horarios, dirección, formas de pago y políticas. Levy responde con esto.",
    title: "Los datos de tu negocio",
  },
];

function Hero({ children, eyebrow, mark, title }: { children: React.ReactNode; eyebrow: string; mark: string; title: string }) {
  return (
    <div className="w-full max-w-2xl text-center">
      <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-full border-[1.5px] border-ink bg-yellow text-xl font-extrabold">
        {mark}
      </span>
      <p className={`${brandEyebrow} mt-4`}>{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      <div className="mt-4 text-lg leading-8 text-muted">{children}</div>
    </div>
  );
}

function Preparation() {
  return (
    <>
      <section className={brandCard}>
        <h2 className={brandEyebrow}>Mientras llega tu acceso</h2>
        <p className="mt-2 text-ink-2">Ten esto a mano y en 20 minutos lo dejamos funcionando contigo.</p>
        <ol className="mt-6 grid gap-6">
          {preparation.map((item, index) => (
            <li className="flex gap-3.5" key={item.title}>
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-yellow">
                {index + 1}
              </span>
              <div>
                <h3 className="font-extrabold">{item.title}</h3>
                <p className="mt-1 leading-6 text-muted">{item.body}</p>
                {item.href ? (
                  <a
                    className="mt-3 inline-flex h-10 items-center rounded-full border-[1.5px] border-ink bg-white px-4 text-sm font-bold transition hover:bg-yellow-soft"
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.linkLabel} ↗
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={brandNote}>
        <h2 className={brandEyebrow}>Cuando te llegue el correo</h2>
        <p className="mt-2 leading-7">
          Pulsa <strong>«Entra y elige tu contraseña»</strong>, crea tu clave y entrarás directo a la configuración. Te acompañamos en todo el proceso.
        </p>
      </section>

      <p className="rounded-2xl border border-line bg-white p-5 text-center text-sm leading-6 text-ink-2">
        ¿No te llegó el acceso en 15 minutos? Mira en spam o promociones y, si no está, escríbenos a {contact}.
      </p>
    </>
  );
}

export function WelcomeView({ sessionId, state }: { sessionId: string; state: WelcomeViewState }) {
  switch (state.status) {
    case "ready":
      return (
        <>
          <Hero eyebrow="Pago confirmado" mark="✓" title="Listo. Levy ya es tuyo.">
            Tu equipo de agentes está a un paso de empezar a contestar tu WhatsApp.
          </Hero>
          <div className="mt-8 grid w-full max-w-xl gap-4">
            <section className={brandNote}>
              <h2 className={brandEyebrow}>Tu acceso va en camino</h2>
              <p className="mt-2 leading-7">
                Te enviamos el acceso a <strong className="[overflow-wrap:anywhere]">{state.email}</strong>. Abre el correo y elige tu contraseña.
              </p>
              <WelcomeResendButton sessionId={sessionId} />
            </section>
            <Preparation />
          </div>
        </>
      );
    case "preparing":
      return (
        <>
          <Hero eyebrow="Pago confirmado" mark="✓" title="Estamos preparando tu cuenta.">
            Tu pago ha llegado bien. En unos segundos te enviamos el acceso a <strong className="[overflow-wrap:anywhere] text-ink">{state.email}</strong>.
            <WelcomeAutoRefresh />
          </Hero>
          <div className="mt-8 grid w-full max-w-xl gap-4">
            <Preparation />
          </div>
        </>
      );
    case "pending":
      return (
        <>
          <Hero eyebrow="Pago en proceso" mark="…" title="Tu pago se está confirmando.">
            En cuanto se confirme te enviamos el acceso por correo. No tienes que hacer nada más.
          </Hero>
          <div className="mt-8 grid w-full max-w-xl gap-4">
            <Preparation />
          </div>
        </>
      );
    case "unavailable":
      return (
        <Hero eyebrow="Algo no ha ido bien" mark="!" title="No hemos podido comprobar tu pago.">
          Prueba a recargar esta página en un momento. Si ya has pagado, el acceso te llega igualmente por correo. Si no, escríbenos a {contact}.
        </Hero>
      );
    default:
      return (
        <Hero eyebrow="Algo no ha ido bien" mark="!" title="No encontramos este pago.">
          Revisa el enlace. Si ya has pagado, busca nuestro correo con el acceso o escríbenos a {contact}.
        </Hero>
      );
  }
}
