"use client";

import { CalendarCheck, Clock3, Info, Sparkles } from "lucide-react";

import { defaultAgentPresets } from "@/lib/default-agents";

import { HelpBox, NumberedSteps, StepFooter, StepHeading } from "./shared";
import type { StepContext } from "./wizard";

const roleCopy: Record<string, { icon: typeof Info; what: string }> = {
  booking: {
    icon: CalendarCheck,
    what: "Agenda, cambia o cancela citas mirando tu calendario.",
  },
  setter: {
    icon: Sparkles,
    what: "Atiende a quien quiere comprar: entiende qué necesita y lo prepara para agendar.",
  },
  support: {
    icon: Info,
    what: "Responde dudas: horarios, ubicación, servicios, precios y políticas.",
  },
};

export function StepWelcome({ ctx }: { ctx: StepContext }) {
  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Bienvenida"
        title={`Hola. Vamos a poner a Levy a trabajar para ${ctx.workspace.name}.`}
        description={
          <>
            <p>
              Levy responde los WhatsApp de tu negocio con inteligencia artificial,
              agenda citas y te avisa cuando una persona debe intervenir.
            </p>
            <p className="mt-2">
              Vamos a configurarlo juntos, un paso a la vez. No necesitas saber nada
              técnico: cada pantalla te explica qué hacer.
            </p>
          </>
        }
      />

      <div>
        <h3 className="text-base font-semibold">Tu equipo de agentes ya está creado</h3>
        <p className="mt-1 text-sm text-[#647067]">
          Tres asistentes se reparten los chats según lo que pida cada cliente. Más
          adelante podrás cambiarles el nombre.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {defaultAgentPresets.map((preset) => {
            const copy = roleCopy[preset.key];
            const Icon = copy.icon;

            return (
              <div
                className="grid content-start gap-2 rounded-xl border border-[#e2e6df] bg-[#fafbf8] p-4"
                key={preset.key}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-[#10231c] text-[#d2f36b]">
                  <Icon size={18} />
                </span>
                <p className="text-base font-semibold">{preset.agentName}</p>
                <p className="text-sm text-[#4d5a51]">{copy.what}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-base font-semibold">Qué necesitas tener a mano</h3>
        <HelpBox title="Tu cuenta de YCloud (donde vive tu número de WhatsApp)">
          <p>
            YCloud es el servicio que conecta tu número de WhatsApp Business con
            Levy. Si tu agencia te la creó, pídele el acceso.
          </p>
          <NumberedSteps
            items={[
              <>Entra en <span className="font-medium">ycloud.com</span> con tu usuario.</>,
              <>Ten a mano el número de WhatsApp que conectaste allí.</>,
              <>En el paso 4 te diremos exactamente de dónde copiar la llave.</>,
            ]}
          />
        </HelpBox>
        <HelpBox title="Tu cuenta de OpenAI (la inteligencia que escribe las respuestas)">
          <p>
            OpenAI es la empresa detrás de ChatGPT. Levy usa tu propia cuenta para
            escribir las respuestas, así pagas solo lo que usas.
          </p>
          <NumberedSteps
            items={[
              <>Crea una cuenta en <span className="font-medium">platform.openai.com</span> si no tienes.</>,
              <>Carga un poco de saldo (con 5 USD alcanza para empezar).</>,
              <>En el paso 3 te guiamos para sacar la llave.</>,
            ]}
          />
        </HelpBox>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-[#eef2eb] px-4 py-3 text-sm text-[#4d5a51]">
        <Clock3 size={16} />
        Toma unos 10 minutos. Puedes parar cuando quieras y seguir después.
      </p>

      <StepFooter nextLabel="Empezar" onNext={ctx.goNext} />
    </div>
  );
}
