"use client";

import { useState } from "react";

const euros = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

const lateOptions = [
  { label: "1 de cada 10", value: "0.1" },
  { label: "2 de cada 10", value: "0.2" },
  { label: "3 de cada 10", value: "0.3" },
  { label: "La mitad", value: "0.5" },
  { label: "La mayoría", value: "0.7" },
];

const fieldClass =
  "mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-yellow";

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function LossCalculator() {
  const [chats, setChats] = useState("30");
  const [late, setLate] = useState("0.3");
  const [closing, setClosing] = useState("2");
  const [ticket, setTicket] = useState("150");
  const [calculated, setCalculated] = useState(false);

  const lostChats = toNumber(chats) * toNumber(late) * 52;
  const lostSales = lostChats * (Math.min(toNumber(closing), 10) / 10);
  const lostMoney = lostSales * toNumber(ticket);

  return (
    <div className="mt-10 rounded-2xl border-2 border-ink bg-white p-5 text-left sm:p-7">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">
          Chats nuevos por semana
          <input className={fieldClass} inputMode="numeric" min="0" onChange={(event) => setChats(event.target.value)} type="number" value={chats} />
        </label>
        <label className="text-sm font-bold">
          Se contestan tarde o nunca
          <select className={fieldClass} onChange={(event) => setLate(event.target.value)} value={late}>
            {lateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Compran, de cada 10 atendidos
          <input className={fieldClass} inputMode="numeric" max="10" min="0" onChange={(event) => setClosing(event.target.value)} type="number" value={closing} />
        </label>
        <label className="text-sm font-bold">
          Valor medio de una venta (€)
          <input className={fieldClass} inputMode="numeric" min="0" onChange={(event) => setTicket(event.target.value)} type="number" value={ticket} />
        </label>
      </div>

      {calculated ? (
        <div aria-live="polite" className="mt-6 rounded-2xl bg-yellow-soft p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-ink-2">Ventas que se enfrían al año</p>
              <p className="mt-1 text-4xl font-extrabold">{euros.format(lostSales)}</p>
              <p className="mt-1 text-sm text-muted">de {euros.format(lostChats)} chats que esperaron de más</p>
            </div>
            <div>
              <p className="text-sm font-bold text-ink-2">Eso vale</p>
              <p className="mt-1 text-4xl font-extrabold">{euros.format(lostMoney)} €</p>
              <p className="mt-1 text-sm text-muted">unos {euros.format(lostMoney / 12)} € cada mes</p>
            </div>
          </div>
          <p className="mt-5 leading-7 text-ink-2">
            Cada día sin Levy son <strong className="text-ink">{euros.format(lostMoney / 365)} €</strong> que se van a la competencia. Actívalo hoy y lo dejamos funcionando contigo en 20
            minutos.
          </p>
          <a className="mt-5 inline-flex h-12 items-center rounded-full border-2 border-ink bg-yellow px-7 font-bold transition hover:bg-yellow-strong" href="#precio">
            Activar Levy hoy
          </a>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <button
            className="h-12 rounded-full border-2 border-ink bg-yellow px-7 font-bold transition hover:bg-yellow-strong"
            onClick={() => setCalculated(true)}
            type="button"
          >
            Calcular lo que pierdo
          </button>
        </div>
      )}
    </div>
  );
}
