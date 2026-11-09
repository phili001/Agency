import type { Metadata } from "next";
import Link from "next/link";

import { LegalOwner, LegalPage, LegalSection, legalMail } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/terminos" },
  robots: { follow: true, index: true },
  title: "Términos y condiciones",
};

export default function TermsPage() {
  return (
    <LegalPage
      current="/terminos"
      intro="Las condiciones para contratar y usar Levy. Al activar tu plan las aceptas, así que léelas con calma."
      title="Términos y condiciones"
    >
      <LegalSection title="1. Quiénes somos">
        <LegalOwner />
        <p>
          Levy es un servicio para empresas y profesionales. No está pensado para consumidores ni para uso personal.
        </p>
      </LegalSection>

      <LegalSection title="2. Qué es Levy">
        <p>
          Levy es un panel con agentes de inteligencia artificial que responden el WhatsApp de tu negocio, agendan citas en tu
          calendario y pasan la conversación a una persona de tu equipo cuando hace falta. Incluye una bandeja de chats, un
          CRM con tus contactos y una agenda.
        </p>
        <p>
          Para funcionar necesita dos servicios que contratas tú directamente: un número de WhatsApp Business conectado a
          YCloud y una cuenta de OpenAI. Su uso lo pagas a cada proveedor y no está incluido en el precio de Levy.
        </p>
      </LegalSection>

      <LegalSection title="3. Precio, pago y renovación">
        <ul>
          <li>La suscripción cuesta 99 € al mes más IVA, salvo que se indique otro precio al contratar.</li>
          <li>Se cobra por adelantado cada mes a través de Stripe y se renueva sola hasta que la canceles.</li>
          <li>
            Si cambiamos el precio, te lo avisaremos con al menos 30 días de antelación; podrás cancelar antes de que se
            aplique.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Cancelación">
        <p>
          No hay permanencia. Puedes cancelar cuando quieras desde la sección de facturación del panel o escribiéndonos a{" "}
          {legalMail}. La cancelación evita el siguiente cobro y mantienes el servicio hasta el final del mes ya pagado; no se
          devuelve la parte proporcional de un mes empezado.
        </p>
      </LegalSection>

      <LegalSection title="5. Si un pago falla">
        <p>
          Te avisaremos en el panel y tendrás unos días para actualizar el método de pago. Si no se resuelve, los agentes
          dejan de responder hasta que reactives la suscripción. Mientras tanto no se borra nada: tus conversaciones,
          contactos y citas siguen guardados, y los mensajes que lleguen también se guardan.
        </p>
      </LegalSection>

      <LegalSection title="6. Tu parte">
        <ul>
          <li>Guardar tu contraseña y responder de lo que se haga con tu cuenta y con las de tu equipo.</li>
          <li>
            Dar a tus agentes información correcta de tu negocio (precios, horarios, servicios, políticas) y revisar cómo
            responden.
          </li>
          <li>
            Cumplir las normas de WhatsApp Business y de Meta, las de YCloud y OpenAI, y la normativa aplicable,
            especialmente la de protección de datos y comunicaciones comerciales: escribe solo a quien te haya dado permiso.
          </li>
          <li>
            No usar Levy para enviar spam, engañar, suplantar a otros ni para actividades ilegales. Si lo haces, podemos
            suspender la cuenta.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Sobre la inteligencia artificial">
        <p>
          Las respuestas las genera un modelo de IA a partir de la información que configuras. Aunque Levy está pensado para
          no inventar y para pasar el chat a una persona cuando no sabe algo, la IA puede equivocarse. Revisa la
          configuración de tus agentes y la bandeja con regularidad; puedes pausar la IA en cualquier conversación.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidad y responsabilidad">
        <p>
          Trabajamos para que Levy esté disponible siempre, pero puede haber interrupciones por mantenimiento o por fallos de
          terceros (WhatsApp, YCloud, OpenAI, Google, el alojamiento). No respondemos de esas interrupciones ajenas ni de
          las decisiones que tomes a partir de las respuestas de la IA.
        </p>
        <p>
          En cualquier caso, nuestra responsabilidad total queda limitada a lo que hayas pagado por Levy en los 12 meses
          anteriores al hecho que la origine, salvo dolo o culpa grave.
        </p>
      </LegalSection>

      <LegalSection title="9. Tus datos y el encargo del tratamiento">
        <p>
          Los datos de tu negocio y de tus clientes son tuyos. Respecto a los datos de tus clientes finales, tú eres el
          responsable del tratamiento y Levy actúa como encargado. Con estos términos te comprometes a tratarlos de forma
          lícita, y nosotros a:
        </p>
        <ul>
          <li>Tratarlos solo para prestarte el servicio y siguiendo tus instrucciones.</li>
          <li>Mantenerlos confidenciales y protegidos con medidas de seguridad adecuadas.</li>
          <li>
            Usar solo los subencargados indicados en la <Link href="/privacidad">Política de privacidad</Link> y avisarte si
            cambian.
          </li>
          <li>Ayudarte a atender los derechos de tus clientes y avisarte sin demora de cualquier brecha de seguridad.</li>
          <li>Borrarlos o devolvértelos cuando termine el servicio, si nos lo pides.</li>
        </ul>
        <p>Puedes exportar tus contactos en CSV desde el panel en cualquier momento.</p>
      </LegalSection>

      <LegalSection title="10. Cambios en estos términos">
        <p>
          Si los cambiamos de forma importante te avisaremos con 30 días de antelación. Si no estás de acuerdo, puedes
          cancelar antes de que se apliquen.
        </p>
      </LegalSection>

      <LegalSection title="11. Ley aplicable">
        <p>
          Estos términos se rigen por la ley española. Para cualquier conflicto, las partes se someten a los juzgados y
          tribunales del domicilio del titular, salvo que la ley disponga otro fuero.
        </p>
        <p>
          ¿Dudas? Escríbenos a {legalMail}. Y si quieres saber cómo tratamos los datos, lee la{" "}
          <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
