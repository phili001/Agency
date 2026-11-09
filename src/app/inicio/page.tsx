import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { LossCalculator } from "@/components/landing/loss-calculator";
import { publicPaymentLinkUrl } from "@/lib/billing/links";
import { legalLinks } from "@/lib/legal";

const title = "Levy · Agentes de WhatsApp con IA para tu negocio";
const description = "Agentes con IA que resuelven dudas, venden y agendan citas en tu calendario. A cualquier hora y con la información de tu negocio.";

// Esta ruta se sirve en `/` para quien no tiene sesión (ver src/proxy.ts).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description,
  openGraph: { description, locale: "es_ES", siteName: "Levy", title, type: "website", url: "/" },
  robots: { follow: true, index: true },
  title: { absolute: title },
};

const contactEmail = "hola@agentelevi.com";

const team = [
  {
    body: "Precios, horarios, dirección, servicios, formas de pago y políticas. Las mismas veinte preguntas que hoy contesta alguien de tu equipo a mano.",
    tag: "Recepción",
    title: "Resuelve las dudas de siempre",
  },
  {
    body: "Pregunta qué necesita y para cuándo, y responde a las dudas que frenan la compra. Una pregunta cada vez, sin presionar, como tu mejor vendedor.",
    tag: "Ventas",
    title: "Detecta quién quiere comprar",
  },
  {
    body: "Consulta la disponibilidad, ofrece huecos y confirma la cita. También la cambia o la cancela si el cliente lo pide.",
    tag: "Citas",
    title: "Agenda en tu calendario real",
  },
];

const growth = [
  "Un agente de postventa para quien ya te compró",
  "Uno por sede o línea de negocio, con sus precios y horarios",
  "Si no sabe algo, no inventa: pasa el chat a una persona",
  "Todos los chats en una bandeja, y pausas la IA con un botón",
];

const included = [
  "Todos los agentes que necesites (empiezas con 3 listos)",
  "Citas en tu calendario, creadas por la IA",
  "Bandeja de chats para tu equipo, con resumen y etiquetas de cada cliente",
  "Paso automático a una persona cuando la IA no sabe",
  "CRM incluido, con tus contactos y su seguimiento",
  "Configuración con nosotros y soporte por WhatsApp",
];

const steps = ["Activas tu plan", "Lo configuramos juntos (20 min)", "Tu equipo empieza a responder"];

const faqs = [
  {
    answer: "No. Lo configuramos contigo en unos 20 minutos y te acompañamos en cada paso. Si después te surge cualquier duda, te ayudamos por WhatsApp.",
    question: "¿Necesito saber de tecnología?",
  },
  {
    answer: "Los que necesites. Empiezas con recepción, ventas y citas, y creas más cuando quieras: uno por servicio, por sede o por área.",
    question: "¿Cuántos agentes puedo tener?",
  },
  {
    answer: "Un número de WhatsApp Business conectado a YCloud y una cuenta de OpenAI. El uso de cada uno lo pagas directamente al proveedor y solo por lo que uses (para empezar bastan unos 5 $ de saldo en OpenAI).",
    question: "¿Qué necesito y qué más pago?",
  },
  {
    answer: "Sí. No hay permanencia: cancelas cuando quieras y no se renueva el mes siguiente.",
    question: "¿Puedo cancelar cuando quiera?",
  },
  {
    answer: "Las conversaciones se guardan en tu cuenta y solo las usan tus agentes para atender a tus clientes. No las vendemos ni las compartimos con terceros.",
    question: "¿Qué pasa con los datos de mis clientes?",
  },
];

const chat = [
  { from: "client", text: "Hola, ¿cuánto cuesta el blanqueamiento? ¿Atienden sábados?" },
  { agent: "Agente de recepción", from: "levy", text: "¡Hola! Cuesta 180 € y sí, los sábados abrimos de 9 a 14 h. ¿Es para ti?" },
  { from: "client", text: "Sí, lo quiero para una boda dentro de 3 semanas" },
  { agent: "Agente de ventas", from: "levy", text: "Hay tiempo de sobra. ¿Tienes sensibilidad en los dientes? Así el dentista lo sabe antes." },
  { from: "client", text: "Un poco" },
  { agent: "Agente de citas", from: "levy", text: "Anotado. Tengo el sábado a las 9:00 o a las 10:30. ¿Cuál te va mejor?" },
  { from: "client", text: "9:00" },
];

const primaryButton =
  "inline-flex h-13 items-center justify-center rounded-full border-2 border-ink bg-yellow px-8 text-center font-bold transition hover:bg-yellow-strong";

function Check() {
  return (
    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
      ✓
    </span>
  );
}

export default function LandingPage() {
  // Sin Payment Link configurado la compra no puede hacerse online: el botón
  // lleva al correo para no dejar un enlace roto.
  const paymentUrl = publicPaymentLinkUrl(process.env.STRIPE_PAYMENT_LINK_URL);
  const buyHref = paymentUrl ?? `mailto:${contactEmail}?subject=${encodeURIComponent("Quiero activar Levy")}`;

  return (
    <div className="bg-paper pb-20 text-ink sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link className="flex items-center gap-2.5 text-xl font-extrabold" href="/">
            <Image alt="" height={36} priority src="/levy-logo.png" width={34} />
            Levy
          </Link>
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precio">Precio</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link className="text-sm font-semibold" href="/login">
              Entrar
            </Link>
            <a className="hidden h-10 items-center rounded-full border-2 border-ink bg-yellow px-5 text-sm font-bold transition hover:bg-yellow-strong sm:inline-flex" href="#precio">
              Activar Levy
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-paper-2 px-5 py-14 lg:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Levy · Agentes de WhatsApp con IA</p>
              <h1 className="mt-4 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">Tu WhatsApp, atendido por un equipo de IA. Tú, a lo tuyo.</h1>
              <p className="mt-5 inline-block rounded-md bg-yellow px-2.5 py-1 text-lg font-bold">Lo dejamos funcionando contigo en 20 minutos.</p>
              <p className="mt-5 max-w-xl text-lg leading-8 text-ink-2">{description}</p>
              <a className={`${primaryButton} mt-7`} href="#precio">
                Activar Levy hoy
              </a>
              <p className="mt-4 text-sm text-muted">Sin saber programar · Configuración de 20 minutos incluida · Te acompañamos en todo</p>
            </div>

            <div aria-label="Ejemplo de conversación con los agentes de Levy" className="mx-auto w-full max-w-md rounded-[2rem] border-2 border-ink bg-white p-3" role="img">
              <div className="flex items-center gap-3 border-b border-line px-2 pb-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-yellow text-sm font-extrabold">CS</span>
                <div className="flex-1">
                  <p className="font-bold">Clínica Sonríe</p>
                  <p className="text-xs text-green">en línea</p>
                </div>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">23:47</span>
              </div>
              <div className="grid gap-2.5 px-1 pt-3 text-sm leading-6">
                {chat.map((message) =>
                  message.from === "client" ? (
                    <p className="ml-10 justify-self-end rounded-2xl border border-yellow-strong bg-yellow-soft px-3.5 py-2" key={message.text}>
                      {message.text}
                    </p>
                  ) : (
                    <div className="mr-10" key={message.text}>
                      <p className="rounded-2xl border border-line bg-paper-2 px-3.5 py-2">{message.text}</p>
                      <p className="mt-1 text-xs text-faint">{message.agent}</p>
                    </div>
                  ),
                )}
                <p className="justify-self-center rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white">✓ Cita creada en el calendario · Sáb 9:00</p>
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-mt-16 px-5 py-16" id="como-funciona">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Tu equipo</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">No es un bot. Es un equipo que conoce tu negocio.</h2>
              <p className="mt-4 text-lg leading-8 text-ink-2">Cada mensaje llega al agente que sabe resolverlo. Tu cliente solo nota que le has contestado rápido y bien.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {team.map((agent) => (
                <article className="rounded-2xl border border-line bg-paper-2 p-6" key={agent.tag}>
                  <p className="inline-block rounded-full bg-yellow px-3 py-0.5 text-xs font-bold uppercase">{agent.tag}</p>
                  <h3 className="mt-4 text-xl font-extrabold">{agent.title}</h3>
                  <p className="mt-3 leading-7 text-ink-2">{agent.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-5 grid gap-7 rounded-2xl border-2 border-ink bg-yellow-soft p-6 sm:p-8 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Y los que tú necesites</p>
                <h3 className="mt-3 text-2xl font-extrabold">Tu equipo crece contigo.</h3>
                <p className="mt-3 leading-7 text-ink-2">
                  Esos tres vienen listos desde el primer día. Después creas los agentes que te hagan falta: les escribes sus instrucciones como a alguien nuevo en el equipo y los pruebas antes de
                  ponerlos a trabajar.
                </p>
              </div>
              <ul className="grid content-center gap-3.5 font-medium">
                {growth.map((item) => (
                  <li className="flex gap-3" key={item}>
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-5 pb-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Haz la cuenta</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">¿Cuánto te cuesta contestar tarde?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-ink-2">Quien escribe y no recibe respuesta escribe al siguiente de la lista. Con cuatro datos te decimos cuánto se te escapa al año.</p>
            <LossCalculator />
            <p className="mt-4 text-sm text-faint">Cálculo orientativo: supone que quien no recibe respuesta a tiempo habría comprado como el resto.</p>
          </div>
        </section>

        <section className="scroll-mt-16 bg-paper-2 px-5 py-16" id="precio">
          <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Activa tu equipo de IA ahora</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Hoy lo activas. En 20 minutos lo dejamos funcionando contigo.</h2>
              <ul className="mt-7 grid gap-3.5 font-medium">
                {included.map((item) => (
                  <li className="flex gap-3" key={item}>
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
              <ol className="mt-8 grid gap-3 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <li className="flex items-center gap-3 font-semibold sm:block" key={step}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-yellow font-extrabold sm:mb-2">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm leading-6 text-muted">Si tu número de WhatsApp aún no está verificado por Meta, la activación puede tardar algo más. Te avisamos en cada paso.</p>
            </div>

            <div className="rounded-2xl border-2 border-ink bg-white p-7">
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight">99 €</span>
                <span className="text-ink-2">/mes + IVA</span>
              </p>
              <p className="mt-3 leading-7 text-ink-2">Menos de lo que te cuesta perder una venta a la semana.</p>
              <a className={`${primaryButton} mt-6 w-full`} href={buyHref}>
                Activar Levy hoy
              </a>
              <p className="mt-4 text-sm leading-6 text-muted">WhatsApp (YCloud) y la IA (OpenAI) se pagan aparte, directamente a cada proveedor y solo por lo que uses.</p>
              <p className="mt-2 text-xs leading-5 text-muted">
                Al activar aceptas los{" "}
                <Link className="underline underline-offset-2 hover:text-ink" href="/terminos">
                  Términos
                </Link>{" "}
                y la{" "}
                <Link className="underline underline-offset-2 hover:text-ink" href="/privacidad">
                  Política de privacidad
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="scroll-mt-16 px-5 py-16" id="preguntas">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-9 grid gap-3">
              {faqs.map((faq) => (
                <details className="group rounded-xl border border-line bg-white px-5 py-4" key={faq.question}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span aria-hidden className="text-xl leading-none group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-7 text-ink-2">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-sm text-muted">
        <div className="mx-auto grid max-w-6xl gap-3">
          <p className="font-semibold text-ink">Levy · Agentes de WhatsApp con IA · Todo lo que necesitas, en un solo lugar.</p>
          <p>
            Contacto:{" "}
            <a className="underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
          </p>
          <nav aria-label="Textos legales" className="flex flex-wrap gap-x-5 gap-y-1">
            {legalLinks.map((link) => (
              <Link className="underline underline-offset-4 hover:text-ink" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <p>© 2026 Levy. Todos los derechos reservados. WhatsApp es una marca de Meta Platforms, Inc. Levy no está afiliado a Meta.</p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 sm:hidden">
        <a className={`${primaryButton} w-full`} href={buyHref}>
          Activar Levy hoy · 99 €/mes
        </a>
      </div>
    </div>
  );
}
