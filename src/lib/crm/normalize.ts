/**
 * Normalización de datos de contacto. Puro: lo usan el CRM, la importación CSV
 * y el webhook de Stripe.
 */

/**
 * Teléfono en E.164 (`+` y 8–15 dígitos). Acepta espacios, guiones, puntos,
 * paréntesis y el prefijo internacional `00`. Sin prefijo de país no se puede
 * adivinar el país, así que devuelve null.
 */
export function normalizePhoneE164(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let text = value.trim().replace(/[\s().-]/g, "");

  if (text.startsWith("00")) {
    text = `+${text.slice(2)}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(text) ? text : null;
}

/** Correo en minúsculas y sin espacios; null si no parece un correo. */
export function normalizeEmail(value: string | null | undefined) {
  const text = value?.trim().toLowerCase() ?? "";

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 254 ? text : null;
}

/** Texto opcional recortado; vacío → null. */
export function optionalText(value: unknown, max: number) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().replace(/\s+/g, " ");

  return text ? text.slice(0, max) : null;
}

/** Color `#rrggbb`; si no es válido, el gris por defecto. */
export function normalizeColor(value: unknown, fallback = "#64748b") {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

/**
 * Quita de un término de búsqueda lo que rompería un filtro `or()` de
 * PostgREST (comas, paréntesis) o actuaría de comodín (`%`, `_`, `*`).
 */
export function sanitizeSearchTerm(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[,()%_*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
