/**
 * Contacto humano para quien se atasca en la configuración. El mensaje va
 * preescrito con "quiero hablar con una persona" y el paso: así el agente de
 * WhatsApp lo deriva a handoff y la persona que lo atiende ve en el resumen
 * en qué punto estaba.
 */
export const SUPPORT_PHONE_DISPLAY = "+34 640 10 28 97";
export const SUPPORT_PHONE_E164 = "+34640102897";

export function buildSupportMessage({
  companyName,
  stepIndex,
  stepTitle,
}: {
  companyName: string;
  stepIndex: number | null;
  stepTitle: string;
}) {
  const where =
    stepIndex && stepIndex > 0
      ? `en el paso ${stepIndex} (${stepTitle})`
      : `en la pantalla "${stepTitle}"`;

  return `Hola, quiero hablar con una persona. Estoy ${where} de la configuración de Levy para ${companyName} y tengo una duda.`;
}

export function buildSupportLink(message: string) {
  return `https://wa.me/${SUPPORT_PHONE_E164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
