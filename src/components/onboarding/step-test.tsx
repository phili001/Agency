"use client";

import { Loader2, MessageSquareText, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";

import type { OnboardingChecklist } from "@/lib/onboarding-steps";

import { HelpBox, Notice, NumberedSteps, StepFooter, StepHeading, secondaryButton } from "./shared";
import { type StepContext, getIntegrationConfig } from "./wizard";

type StatusPayload = {
  checklist: OnboardingChecklist;
  lastInbound: { body: string | null; created_at: string; id: string } | null;
  lastReply: { body: string | null; created_at: string; id: string } | null;
};

const POLL_MS = 5000;
const HELP_AFTER_MS = 60000;

export function StepTest({ ctx }: { ctx: StepContext }) {
  const ycloud = ctx.integrations.find((item) => item.provider === "ycloud");
  const phone = String(getIntegrationConfig(ycloud).phone_e164 ?? "");
  const waLink = phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : "";
  const done = ctx.checklist.firstSignalReady;
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch(
          `/api/onboarding/status?workspaceId=${encodeURIComponent(ctx.workspace.id)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(String(response.status));
        }

        const payload = (await response.json()) as StatusPayload;

        if (cancelled) {
          return;
        }

        setStatus(payload);
        setError("");

        if (payload.checklist.firstSignalReady) {
          ctx.patchChecklist({ firstSignalReady: true });
          return;
        }
      } catch {
        if (!cancelled) {
          setError("No pudimos consultar el estado. Seguimos intentando…");
        }
      }

      if (!cancelled) {
        timer = window.setTimeout(poll, POLL_MS);
      }
    }

    void poll();
    const helpTimer = window.setTimeout(() => setShowHelp(true), HELP_AFTER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(helpTimer);
    };
    // Solo depende del workspace: patchChecklist es estable para este uso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.workspace.id]);

  const arrived = done || Boolean(status?.checklist.firstSignalReady);

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 5 · Prueba real"
        title={arrived ? "¡Funciona! Tu primer mensaje ya llegó" : "Hagamos la primera prueba"}
        description={
          arrived
            ? "Levy ya recibe los mensajes de tu número. A partir de ahora los agentes atienden solos y tú los ves en la bandeja."
            : "Usa tu propio celular como si fueras un cliente. Así comprobamos que todo el camino funciona de verdad."
        }
      />

      {!arrived ? (
        <div className="grid gap-4 rounded-xl border-2 border-[#10231c] bg-[#fafbf8] p-5 text-center">
          <p className="text-base text-[#4d5a51]">
            Desde tu celular, escribe <span className="font-semibold">Hola</span> por WhatsApp al número
          </p>
          <p className="text-3xl font-semibold tabular-nums tracking-wide">{phone || "—"}</p>
          {waLink ? (
            <a
              className={`${secondaryButton} mx-auto`}
              href={waLink}
              rel="noreferrer"
              target="_blank"
            >
              <MessageSquareText size={18} />
              Abrir WhatsApp con este número
            </a>
          ) : null}
          <p className="flex items-center justify-center gap-2 text-sm text-[#647067]">
            <Loader2 className="animate-spin" size={16} />
            Esperando tu mensaje… no cierres esta pantalla.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl border border-[#b9dc9c] bg-[#eef6df] p-5">
          <div className="flex items-center gap-2 text-[#31521d]">
            <PartyPopper size={20} />
            <p className="text-base font-semibold">Conexión confirmada</p>
          </div>
          {status?.lastInbound?.body ? (
            <div className="grid gap-2">
              <div className="max-w-[85%] justify-self-start rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm shadow-sm">
                <p className="text-[11px] font-semibold uppercase text-[#647067]">Cliente</p>
                <p className="mt-0.5 text-[#20231f]">{status.lastInbound.body}</p>
              </div>
              {status.lastReply?.body ? (
                <div className="max-w-[85%] justify-self-end rounded-2xl rounded-br-sm bg-[#10231c] px-4 py-2 text-sm text-white shadow-sm">
                  <p className="text-[11px] font-semibold uppercase text-[#b7c4bd]">Levy</p>
                  <p className="mt-0.5">{status.lastReply.body}</p>
                </div>
              ) : (
                <p className="text-sm text-[#4d5a51]">
                  La respuesta de la IA tarda unos 15 segundos en salir (agrupa mensajes
                  antes de contestar). Míralo en tu celular.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {!arrived && showHelp ? (
        <HelpBox defaultOpen title="¿No llega nada? Revisa esto">
          <NumberedSteps
            items={[
              <>
                <span className="font-medium">La dirección del paso anterior está pegada en YCloud</span>{" "}
                (Developers → Webhooks) y los eventos de mensaje están marcados. Es la causa más común.
              </>,
              <>
                <span className="font-medium">Escribiste al número correcto</span>: {phone || "el número configurado"}.
              </>,
              <>
                <span className="font-medium">Dale unos segundos.</span> Levy agrupa los mensajes 15
                segundos antes de responder; esta pantalla se actualiza sola.
              </>,
            ]}
          />
          <button
            className="justify-self-start text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
            onClick={() => ctx.goTo(4)}
            type="button"
          >
            Volver a ver la dirección para YCloud
          </button>
        </HelpBox>
      ) : null}

      {error ? <Notice>{error}</Notice> : null}

      <StepFooter
        nextDisabled={!arrived}
        onBack={ctx.goBack}
        onNext={ctx.goNext}
        secondary={
          !arrived ? (
            <button className={secondaryButton} onClick={ctx.goNext} type="button">
              Lo pruebo después
            </button>
          ) : null
        }
      />
    </div>
  );
}
