/**
 * Datos del titular que muestran las páginas legales (/privacidad, /terminos,
 * /cookies). Rellena los que falten: mientras estén vacíos, esa línea no sale.
 * La LSSI y el RGPD piden nombre o razón social, NIF y domicilio.
 */
export const legalEntity = {
  /** Nombre y apellidos (autónomo) o razón social (p. ej. «Levy Tech S.L.»). */
  name: "",
  /** NIF o CIF. */
  taxId: "",
  /** Domicilio completo. */
  address: "",
  country: "España",
  email: "info@agentelevi.com",
  website: "agentelevi.com",
  /** Fecha de la última revisión de los textos. */
  updatedAt: "8 de noviembre de 2026",
};

export const legalLinks = [
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/cookies", label: "Cookies" },
] as const;
