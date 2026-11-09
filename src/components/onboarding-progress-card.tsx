import { ArrowRight, Check, Circle, Sparkles } from "lucide-react";
import Link from "next/link";

import {
  type OnboardingChecklist,
  getPendingSteps,
  onboardingSteps,
} from "@/lib/onboarding-steps";
import {
  SUPPORT_PHONE_DISPLAY,
  buildSupportLink,
  buildSupportMessage,
} from "@/lib/support";

/**
 * Recordatorio en la bandeja para quien entro al panel sin terminar el
 * onboarding. Desaparece solo cuando el wizard se completa.
 */
export function OnboardingProgressCard({
  checklist,
  companyName,
}: {
  checklist: OnboardingChecklist;
  companyName: string;
}) {
  const pending = getPendingSteps(checklist);
  const required = onboardingSteps.filter((step) => !step.optional && step.checklistKey);
  const doneCount = required.length - pending.length;
  const next = pending[0];

  return (
    <section className="rounded-lg border border-yellow-strong bg-yellow-soft p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink text-yellow">
            <Sparkles size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold">
              {pending.length === 0
                ? "Ya tienes todo listo. Confirma para cerrar la configuración."
                : `Te faltan ${pending.length} ${pending.length === 1 ? "paso" : "pasos"} para que Levy responda solo`}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {!checklist.ycloudReady
                ? "Aún no recibes mensajes: conecta tu WhatsApp para empezar."
                : !checklist.openaiReady
                  ? "Los mensajes llegan pero la IA no puede responder hasta conectar OpenAI."
                  : `${doneCount} de ${required.length} completados. Lo que guardaste sigue guardado.`}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-4 text-sm font-bold text-ink"
          href={`/onboarding?paso=${next?.index ?? onboardingSteps.length - 1}`}
        >
          {next ? `Continuar: ${next.shortTitle}` : "Terminar configuración"}
          <ArrowRight size={16} />
        </Link>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {required.map((step) => {
          const done = step.checklistKey ? checklist[step.checklistKey] : false;

          return (
            <li key={step.id}>
              <Link
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  done
                    ? "border-transparent bg-white/60 text-ink-2"
                    : "border-line bg-white font-medium text-ink hover:border-ink"
                }`}
                href={`/onboarding?paso=${step.index}`}
              >
                {done ? (
                  <Check className="shrink-0 text-ink" size={16} />
                ) : (
                  <Circle className="shrink-0 text-line-strong" size={16} />
                )}
                <span className="truncate">{step.shortTitle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-ink-2">
        ¿Te atascaste? Escríbenos al WhatsApp{" "}
        <a
          className="font-semibold text-ink underline-offset-4 hover:underline"
          href={buildSupportLink(
            buildSupportMessage({
              companyName,
              stepIndex: next?.index ?? null,
              stepTitle: next?.shortTitle ?? "Configuración",
            }),
          )}
          rel="noreferrer"
          target="_blank"
        >
          {SUPPORT_PHONE_DISPLAY}
        </a>
        . Di que quieres hablar con una persona y en qué paso vas.
      </p>
    </section>
  );
}
