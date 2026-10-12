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

/**
 * "GMT+2" para enseñar la diferencia horaria sin jerga. Se calcula con el
 * desfase actual, que es estable salvo el día del cambio de hora.
 */
export function getZoneOffsetLabel(zone: string) {
  try {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
