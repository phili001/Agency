"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";

import { readApiError } from "@/components/onboarding/shared";

/**
 * Tarjeta de Google Calendar en Integraciones (sustituye a la de GoHighLevel).
 * Conectar va a Google y vuelve a `/integraciones?google=conectado` o
 * `?google=error&motivo=…`; aquí se lee ese resultado para mostrarlo.
 */

type Status = {
  accountEmail: string | null;
  configured: boolean;
  connected: boolean;
  lastError: string | null;
  status: string;
};

export function GoogleCalendarCard({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations/google-calendar/status");
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo leer el estado de Google Calendar."));
      return;
    }
    setStatus((await response.json()) as Status);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");

    if (result) {
      // El resultado de la vuelta de Google se enseña una vez y se limpia de la URL.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(result === "conectado" ? "Google Calendar quedó conectado." : "");
      setError(result === "error" ? params.get("motivo") ?? "No se pudo conectar Google Calendar." : "");
      params.delete("google");
      params.delete("motivo");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }

    if (canManage) {
      void load();
    }
  }, [canManage, load]);

  async function disconnect() {
    if (!window.confirm("¿Desconectar Google Calendar? Las citas dejan de copiarse a Google.")) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/integrations/google-calendar/disconnect", { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      setError(await readApiError(response, "No se pudo desconectar."));
      return;
    }
    setNotice("Google Calendar desconectado.");
    await load();
  }

  const badge = status?.connected
    ? { className: "bg-[#e7f6ce] text-[#31521d]", label: "Conectado" }
    : status?.status === "error"
      ? { className: "bg-[#f8dcd6] text-[#7a2f1d]", label: "Hay que reconectar" }
      : { className: "bg-[#eef2eb] text-[#4d5a51]", label: "Sin conectar" };

  return (
    <div className="grid content-start gap-3 rounded-lg border border-[#e2e6df] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <CalendarDays size={16} /> Google Calendar
          </h3>
          <p className="mt-1 text-sm text-[#647067]">
            Opcional. Copia las citas de tu agenda a tu Google Calendar y, si quieres, evita ofrecer horas en las que ya
            tienes algo allí.
          </p>
        </div>
        {status ? <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span> : null}
      </div>

      {notice ? <p className="rounded-lg border border-[#d9ded3] bg-[#fafbf8] p-2 text-sm">{notice}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {!canManage ? (
        <p className="text-sm text-[#647067]">Solo el dueño o un admin de la empresa puede conectar Google Calendar.</p>
      ) : !status ? (
        <Loader2 className="animate-spin text-[#647067]" size={16} />
      ) : !status.configured ? (
        <p className="text-sm text-[#647067]">
          Google Calendar todavía no está disponible en este servidor. Avisa a soporte.
        </p>
      ) : (
        <>
          {status.connected && status.accountEmail ? (
            <p className="text-sm">
              Conectado como <strong>{status.accountEmail}</strong>. Elige en cada agenda en qué calendario copiar las citas.
            </p>
          ) : null}
          {status.status === "error" && status.lastError ? (
            <p className="text-sm text-[#7a2f1d]">{status.lastError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!status.connected ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white"
                onClick={() => {
                  // Va a la pantalla de permisos de Google (navegación completa).
                  window.location.href = "/api/integrations/google-calendar/connect";
                }}
                type="button"
              >
                {status.status === "error" ? "Volver a conectar" : "Conectar Google Calendar"}
              </button>
            ) : (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium disabled:opacity-60"
                disabled={busy}
                onClick={disconnect}
                type="button"
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : null}
                Desconectar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
