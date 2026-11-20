"use client";

import { useSyncExternalStore } from "react";

import {
  FOUNDERS_DAY_LABEL,
  FOUNDERS_MONTHLY_EUR,
  FOUNDERS_SEATS,
  FOUNDERS_YEARLY_EUR,
  type FoundersStatus,
  foundersStatus,
} from "@/lib/billing/founders";

type Props = {
  contactEmail: string;
  monthlyUrl: string | null;
  yearlyUrl: string | null;
};

const perks = [
  "Todo lo del plan Levy Agentes",
  "Cada módulo nuevo que lancemos, incluido sin coste extra",
  "Tu precio no sube mientras tu suscripción siga activa",
];

// Revisa la fecha cada minuto: la oferta abre y cierra a medianoche de Madrid.
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

const currentStatus = () => foundersStatus(new Date());
// En el servidor la página se construye una vez: se pinta cerrada hasta que el navegador mira la hora.
const serverStatus = (): FoundersStatus | null => null;

const buttonBase = "inline-flex h-13 w-full items-center justify-center rounded-full border-2 px-6 text-center font-bold transition";

function BuyButton({ href, label, open }: { href: string; label: string; open: boolean }) {
  if (!open) {
    return (
      <span aria-disabled className={`${buttonBase} cursor-not-allowed border-white/30 text-white/60`}>
        {label}
      </span>
    );
  }
  return (
    <a className={`${buttonBase} border-yellow bg-yellow text-ink hover:bg-yellow-strong`} href={href}>
      {label}
    </a>
  );
}

export function FoundersOffer({ contactEmail, monthlyUrl, yearlyUrl }: Props) {
  const status = useSyncExternalStore(subscribe, currentStatus, serverStatus);
  const open = status === "open";
  const mail = (plan: string) => `mailto:${contactEmail}?subject=${encodeURIComponent(`Quiero LEVYFOUNDERS ${plan}`)}`;

  const notice =
    status === "open"
      ? `Abierta hoy · ${FOUNDERS_SEATS} plazas por modalidad`
      : status === "closed"
        ? "Plazas cerradas"
        : `Abre el ${FOUNDERS_DAY_LABEL}`;

  return (
    <div className="rounded-2xl border-2 border-ink bg-dark p-7 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rounded-full bg-yellow px-3 py-0.5 text-xs font-bold tracking-wide text-ink uppercase">LEVYFOUNDERS</p>
        <p className="text-sm font-semibold text-yellow" role="status">
          {status === null ? `Solo el ${FOUNDERS_DAY_LABEL}` : notice}
        </p>
      </div>
      <h3 className="mt-4 text-2xl font-extrabold">Entra como fundador y quédate con todo lo que venga.</h3>
      <p className="mt-3 leading-7 text-white/80">
        Solo el {FOUNDERS_DAY_LABEL} y {FOUNDERS_SEATS} plazas por modalidad. Hoy tienes lo mismo que en Levy Agentes; cada
        módulo nuevo entra en tu plan sin pagar más. Ahora trabajamos en grabar la pantalla de tu ordenador con cámara y en un
        agente de llamadas.
      </p>
      <ul className="mt-5 grid gap-3 font-medium">
        {perks.map((perk) => (
          <li className="flex gap-3" key={perk}>
            <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              ✓
            </span>
            {perk}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/20 p-4">
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold">{FOUNDERS_MONTHLY_EUR} €</span>
            <span className="text-white/70">/mes</span>
          </p>
          <p className="mt-1 text-sm text-white/70">IVA incluido</p>
          <div className="mt-4">
            <BuyButton href={monthlyUrl ?? mail("mensual")} label={open ? "Quiero el mensual" : notice} open={open} />
          </div>
        </div>
        <div className="rounded-xl border border-yellow p-4">
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold">{FOUNDERS_YEARLY_EUR} €</span>
            <span className="text-white/70">/año</span>
          </p>
          <p className="mt-1 text-sm text-white/70">IVA incluido · ahorras {FOUNDERS_MONTHLY_EUR * 12 - FOUNDERS_YEARLY_EUR} € (dos meses)</p>
          <div className="mt-4">
            <BuyButton href={yearlyUrl ?? mail("anual")} label={open ? "Quiero el anual" : notice} open={open} />
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-white/60">
        Mantienes este precio y los módulos nuevos mientras tu suscripción siga activa. Si la cancelas, o se cancela por un
        pago que no se resuelve, al volver pagarás el precio vigente. Sin permanencia.
      </p>
    </div>
  );
}
