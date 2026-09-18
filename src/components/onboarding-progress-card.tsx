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
    <section className="rounded-lg border border-[#b9dc9c] bg-[#eef6df] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
            <Sparkles size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold">
              {pending.length === 0
                ? "Ya tienes todo listo. Confirma para cerrar la configuración."
                : `Te faltan ${pending.length} ${pending.length === 1 ? "paso" : "pasos"} para que Levy responda solo`}
            </h2>
            <p className="mt-1 text-sm text-[#4d5a51]">
              {!checklist.ycloudReady
                ? "Aún no recibes mensajes: conecta tu WhatsApp para empezar."
                : !checklist.openaiReady
                  ? "Los mensajes llegan pero la IA no puede responder hasta conectar OpenAI."
                  : `${doneCount} de ${required.length} completados. Lo que guardaste sigue guardado.`}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-4 text-sm font-semibold text-white"
          href={next ? `/onboarding?paso=${next.index}` : "/onboarding?paso=7"}
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
                    ? "border-transparent bg-white/60 text-[#4d5a51]"
                    : "border-[#cbd2c6] bg-white font-medium text-[#20231f] hover:border-[#35735b]"
                }`}
                href={`/onboarding?paso=${step.index}`}
              >
                {done ? (
                  <Check className="shrink-0 text-[#35735b]" size={16} />
                ) : (
                  <Circle className="shrink-0 text-[#c3cac2]" size={16} />
                )}
                <span className="truncate">{step.shortTitle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-[#4d5a51]">
        ¿Te atascaste? Escríbenos al WhatsApp{" "}
        <a
          className="font-semibold text-[#20231f] underline-offset-4 hover:underline"
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
