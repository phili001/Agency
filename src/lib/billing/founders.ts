/**
 * Oferta LEVYFOUNDERS: se vende solo un día (hora de Madrid) y con plazas
 * limitadas por modalidad. Stripe activa y desactiva los enlaces; la landing
 * usa esto para no mandar a nadie a un enlace cerrado.
 */

export const FOUNDERS_DAY = "2026-11-27";
export const FOUNDERS_DAY_LABEL = "viernes 27 de noviembre";
export const FOUNDERS_SEATS = 10;
export const FOUNDERS_MONTHLY_EUR = 150;
export const FOUNDERS_YEARLY_EUR = 1500;
export const LEVY_MONTHLY_EUR = 100;

export type FoundersStatus = "soon" | "open" | "closed";

const madridDate = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid", year: "numeric" });

/** Fecha (AAAA-MM-DD) de `now` en Madrid. */
function dayInMadrid(now: Date) {
  return madridDate.format(now);
}

export function foundersStatus(now: Date, day: string = FOUNDERS_DAY): FoundersStatus {
  const today = dayInMadrid(now);
  if (today < day) return "soon";
  if (today === day) return "open";
  return "closed";
}
