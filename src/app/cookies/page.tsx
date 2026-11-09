import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection, legalMail } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/cookies" },
  robots: { follow: true, index: true },
  title: "Política de cookies",
};

const cookies = [
  {
    name: "sb-…-auth-token",
    owner: "Levy (Supabase)",
    purpose: "Mantiene tu sesión iniciada en el panel.",
    duration: "Hasta que cierras sesión",
  },
  {
    name: "levy-tour-…",
    owner: "Levy (almacenamiento local)",
    purpose: "Recuerda qué guías del panel ya has visto para no repetirlas.",
    duration: "Hasta que borras los datos del navegador",
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      current="/cookies"
      intro="Levy solo usa lo imprescindible para funcionar. No hay cookies de publicidad ni de analítica, por eso no te pedimos que aceptes nada."
      title="Política de cookies"
    >
      <LegalSection title="1. Qué son">
        <p>
          Las cookies son pequeños archivos que una web guarda en tu navegador. Algo parecido es el almacenamiento local, que
          guarda preferencias en tu propio dispositivo.
        </p>
      </LegalSection>

      <LegalSection title="2. Cuáles usamos">
        <p>
          Solo técnicas: sin ellas no podrías iniciar sesión ni usar el panel. La ley permite usarlas sin pedir
          consentimiento.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-paper-2 text-xs font-bold tracking-[0.6px] text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">De quién</th>
                <th className="px-4 py-3">Para qué</th>
                <th className="px-4 py-3">Duración</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie) => (
                <tr className="border-t border-line align-top" key={cookie.name}>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{cookie.name}</td>
                  <td className="px-4 py-3">{cookie.owner}</td>
                  <td className="px-4 py-3">{cookie.purpose}</td>
                  <td className="px-4 py-3">{cookie.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>La landing pública no guarda ninguna cookie mientras no inicies sesión.</p>
      </LegalSection>

      <LegalSection title="3. Servicios de terceros">
        <p>
          Al pagar se abre la página de <strong>Stripe</strong>, y al conectar Google Calendar la de <strong>Google</strong>.
          Esas páginas son suyas y usan sus propias cookies, según sus políticas.
        </p>
      </LegalSection>

      <LegalSection title="4. Cómo borrarlas">
        <p>
          Puedes borrar o bloquear las cookies desde los ajustes de tu navegador. Si bloqueas las de sesión, no podrás entrar
          al panel.
        </p>
        <p>
          ¿Dudas? Escríbenos a {legalMail}. Más detalles en la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
