"use client";

import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { useState } from "react";

import { getPendingSteps } from "@/lib/onboarding-steps";

import {
  Notice,
  StepHeading,
  primaryButton,
  readApiError,
  secondaryButton,
} from "./shared";
import type { StepContext } from "./wizard";

export function StepDone({ ctx }: { ctx: StepContext }) {
  const pending = getPendingSteps(ctx.checklist);
  const complete = pending.length === 0;
  const ghlConnected = ctx.integrations.some(
    (item) => item.provider === "gohighlevel" && item.status === "active",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = [
    { done: ctx.checklist.businessReady, label: "Datos de tu negocio", step: 1 },
    { done: ctx.checklist.agentReady, label: "Agentes confirmados", step: 2 },
    { done: ctx.checklist.openaiReady, label: "OpenAI conectado", step: 3 },
    { done: ctx.checklist.ycloudReady, label: "WhatsApp conectado", step: 4 },
    { done: ctx.checklist.firstSignalReady, label: "Primer mensaje recibido", step: 5 },
    { done: ctx.checklist.teamReady, label: "Equipo invitado (opcional)", step: 6 },
    { done: ghlConnected, label: "GoHighLevel (opcional)", step: 6 },
  ];

  async function enter() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/workspaces", {
      body: JSON.stringify({
        action: complete ? "complete_onboarding" : "skip_onboarding",
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo terminar. Inténtalo otra vez."));
      setBusy(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Listo"
        title={complete ? "Levy ya está trabajando para ti" : "Casi listo"}
        description={
          complete
            ? "Los agentes atienden tu WhatsApp y tú ves todo desde la bandeja. Al entrar te mostramos en 1 minuto cómo se usa."
            : "Puedes entrar ya al panel. Lo que falta te lo recordamos allí, y lo terminas cuando quieras."
        }
      />

      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e6df] bg-[#fafbf8] px-4 py-3"
            key={item.label}
          >
            <span className="flex items-center gap-3 text-base">
              {item.done ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-[#35735b] text-white">
                  <Check size={15} />
                </span>
              ) : (
                <Circle className="mx-1 text-[#c3cac2]" size={20} />
              )}
              {item.label}
            </span>
            {!item.done ? (
              <button
                className="text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
                onClick={() => ctx.goTo(item.step)}
                type="button"
              >
                Completar
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-[#e2e6df] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button className={secondaryButton} onClick={ctx.goBack} type="button">
          Atrás
        </button>
        <button className={primaryButton} disabled={busy} onClick={enter} type="button">
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          {complete ? "Entrar a Levy" : "Entrar igual, termino después"}
          {!busy ? <ArrowRight size={18} /> : null}
        </button>
      </div>
    </div>
  );
}
