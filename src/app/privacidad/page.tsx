import type { Metadata } from "next";
import Link from "next/link";

import { LegalOwner, LegalPage, LegalSection, legalMail } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/privacidad" },
  robots: { follow: true, index: true },
  title: "Política de privacidad",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacidad"
      intro="Qué datos tratamos, para qué, con quién los compartimos y cómo ejercer tus derechos. Sin letra pequeña escondida."
      title="Política de privacidad"
    >
      <LegalSection title="1. Quién es el responsable">
        <p>El responsable de los datos de las personas que contratan y usan Levy es:</p>
        <LegalOwner />
        <p>Para cualquier cuestión sobre privacidad escríbenos a {legalMail}.</p>
      </LegalSection>

      <LegalSection title="2. Dos papeles distintos">
        <p>Levy trata datos en dos calidades diferentes, y conviene distinguirlas:</p>
        <ul>
          <li>
            <strong>Como responsable</strong>, de los datos de quien contrata Levy y de su equipo: nombre, correo, empresa,
            datos de facturación y uso del panel.
          </li>
          <li>
            <strong>Como encargado del tratamiento</strong>, de los datos de los clientes finales de cada negocio (las
            personas que escriben a su WhatsApp): nombre, teléfono, mensajes, citas, notas y etiquetas. Aquí el
            responsable es el negocio que usa Levy; nosotros solo tratamos esos datos siguiendo sus instrucciones y para
            prestarle el servicio, en los términos del apartado «Encargo del tratamiento» de los{" "}
            <Link href="/terminos">Términos</Link>.
          </li>
        </ul>
        <p>
          Si escribiste a un negocio por WhatsApp y quieres ejercer tus derechos, dirígete a ese negocio. Si nos escribes a
          nosotros, se lo trasladaremos.
        </p>
      </LegalSection>

      <LegalSection title="3. Qué datos tratamos como responsable y para qué">
        <ul>
          <li>
            <strong>Alta y cuenta</strong>: nombre, correo, empresa y contraseña (guardada cifrada), para crear tu acceso y
            prestarte el servicio. Base: ejecución del contrato.
          </li>
          <li>
            <strong>Pago y facturación</strong>: datos de facturación e historial de la suscripción. Los datos de la tarjeta
            los recoge y guarda Stripe; nosotros no los vemos. Base: contrato y obligación legal.
          </li>
          <li>
            <strong>Soporte y comunicaciones del servicio</strong>: lo que nos cuentes por correo o WhatsApp y los avisos
            necesarios (acceso, pagos, cambios). Base: contrato.
          </li>
          <li>
            <strong>Seguridad y funcionamiento</strong>: registros técnicos (fechas, errores, acciones en el panel) para
            evitar abusos y resolver fallos. Base: interés legítimo.
          </li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad. No elaboramos perfiles con fines comerciales.</p>
      </LegalSection>

      <LegalSection title="4. Con quién los compartimos">
        <p>Solo con los proveedores que necesitamos para que Levy funcione, con contratos que les obligan a proteger los datos:</p>
        <ul>
          <li><strong>Supabase</strong>: base de datos y acceso de usuarios.</li>
          <li><strong>Vercel</strong>: alojamiento de la aplicación.</li>
          <li><strong>Stripe</strong>: cobro de la suscripción.</li>
          <li><strong>Hostinger</strong>: envío de los correos de la plataforma.</li>
          <li>
            <strong>Google</strong>: solo si conectas Google Calendar, para crear y consultar citas en tu calendario.
          </li>
        </ul>
        <p>
          Los mensajes de WhatsApp pasan por <strong>YCloud</strong> y las respuestas las genera <strong>OpenAI</strong>,
          ambos con las cuentas que contrata cada negocio. Esos servicios se rigen también por sus propias condiciones, que
          el negocio acepta al darse de alta en ellos.
        </p>
        <p>
          Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo (por ejemplo, en Estados
          Unidos). En ese caso lo hacen con las garantías que exige el RGPD, como las cláusulas contractuales tipo de la
          Comisión Europea o el Marco de Privacidad de Datos UE-EE. UU.
        </p>
      </LegalSection>

      <LegalSection title="5. Cuánto tiempo los guardamos">
        <p>
          Mientras tengas la cuenta activa. Si te das de baja, puedes pedirnos que borremos tus datos y los de tus clientes
          finales. Conservaremos bloqueado solo lo que la ley nos obliga a guardar, como las facturas, durante los plazos
          legales.
        </p>
        <p>
          Desde el panel, el negocio puede borrar en cualquier momento a un contacto con todo lo suyo: conversaciones,
          mensajes, notas, tareas y citas.
        </p>
      </LegalSection>

      <LegalSection title="6. Tus derechos">
        <p>
          Puedes pedir acceso a tus datos, corregirlos, borrarlos, limitar u oponerte a su tratamiento y llevártelos a otro
          servicio. Escríbenos a {legalMail} indicando qué necesitas; te responderemos en un plazo máximo de un mes.
        </p>
        <p>
          Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
          (<a href="https://www.aepd.es" rel="noopener noreferrer" target="_blank">aepd.es</a>).
        </p>
      </LegalSection>

      <LegalSection title="7. Seguridad">
        <p>
          Las conexiones van cifradas, las claves de tus integraciones (OpenAI, YCloud) se guardan cifradas y cada empresa
          solo ve sus propios datos. Dentro de cada empresa, cada persona accede según su rol.
        </p>
      </LegalSection>

      <LegalSection title="8. Cambios">
        <p>
          Si cambiamos esta política de forma importante, te avisaremos por correo o en el panel antes de que se aplique.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
