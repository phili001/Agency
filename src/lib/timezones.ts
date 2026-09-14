/**
 * Zonas horarias IANA reales del navegador. La zona del negocio decide a que
 * hora se agenda, asi que no puede ser texto libre: "Colombia" o "GMT-5" no son
 * zonas validas y se descartarian en silencio al consultar el calendario.
 */
export function getTimeZoneOptions() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** Zona del navegador, para proponerla como valor inicial. */
export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
