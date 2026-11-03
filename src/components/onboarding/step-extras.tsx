"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

import {
  Field,
  HelpBox,
  HowTo,
  Notice,
  NumberedSteps,
  StepFooter,
  StepHeading,
  inputClass,
  primaryButton,
  readApiError,
} from "./shared";
import { GoogleCalendarCard } from "@/components/crm/google-calendar-card";

import { type StepContext } from "./wizard";

const roleOptions = [
  { description: "Responde chats y ve los clientes.", label: "Atiende chats", value: "agent" },
  { description: "Puede configurar todo, como tú.", label: "Administra", value: "admin" },
  { description: "Solo mira, no puede escribir.", label: "Solo mira", value: "viewer" },
] as const;

export function StepExtras({ ctx }: { ctx: StepContext }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("agent");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");

  async function invite() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@")) {
      setTeamError("Escribe un correo válido.");
      return;
    }

    if (password.trim().length < 8) {
      setTeamError("La contraseña temporal debe tener al menos 8 caracteres.");
      return;
    }

    setTeamBusy(true);
    setTeamError("");
    setTeamSuccess("");
    const response = await fetch("/api/team/members", {
      body: JSON.stringify({
        email: cleanEmail,
        role,
        temporaryPassword: password.trim(),
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setTeamBusy(false);

    if (!response.ok) {
      setTeamError(await readApiError(response, "No se pudo invitar a esa persona."));
      return;
    }

    ctx.setMemberCount(ctx.memberCount + 1);
    ctx.patchChecklist({ teamReady: true });
    setTeamSuccess(
      `Listo. Dile a ${cleanEmail} que entre en ${ctx.appUrl} con esa contraseña temporal y la cambie.`,
    );
    setEmail("");
    setPassword("");
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 6 · Extras"
        title="Dos cosas opcionales"
        description="Ninguna es obligatoria para que Levy funcione. Si no aplican a tu negocio, pasa al siguiente paso."
      />

      <HowTo
        items={[
          <>Abre la caja que te interese: <span className="font-medium">Invitar a tu equipo</span> o <span className="font-medium">Conectar Google Calendar</span>.</>,
          <>Rellena lo que pide y pulsa su botón (Invitar / Conectar con Google). Puedes invitar a varias personas.</>,
          <>Si ninguna aplica, pulsa <span className="font-medium">Siguiente</span> sin más.</>,
        ]}
      />

      <HelpBox
        defaultOpen={ctx.memberCount <= 1}
        title={`Invitar a tu equipo${ctx.memberCount > 1 ? ` (ya hay ${ctx.memberCount} personas)` : ""}`}
      >
        <p>
          Cada persona entra con su propio correo y ve la misma bandeja de chats. Le
          creas una contraseña temporal y ella la cambia al entrar.
        </p>
        <NumberedSteps
          items={[
            <>Escribe su <span className="font-medium">correo</span>.</>,
            <>Inventa una <span className="font-medium">contraseña temporal</span> (mínimo 8 caracteres) y dísela después.</>,
            <>Elige qué puede hacer y pulsa <span className="font-medium">Invitar</span>.</>,
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correo">
            <input
              className={inputClass}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="persona@tuempresa.com"
              type="email"
              value={email}
            />
          </Field>
          <Field help="Mínimo 8 caracteres." label="Contraseña temporal">
            <input
              autoComplete="new-password"
              className={inputClass}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ej: Levy2026!"
              type="text"
              value={password}
            />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {roleOptions.map((option) => (
            <button
              aria-pressed={role === option.value}
              className={`grid gap-1 rounded-xl border-2 p-3 text-left ${
                role === option.value
                  ? "border-[#10231c] bg-[#eef6df]"
                  : "border-[#e2e6df] bg-white"
              }`}
              key={option.value}
              onClick={() => setRole(option.value)}
              type="button"
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-[#4d5a51]">{option.description}</span>
            </button>
          ))}
        </div>
        <div>
          <button className={primaryButton} disabled={teamBusy} onClick={invite} type="button">
            {teamBusy ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
            Invitar
          </button>
        </div>
        {teamError ? <Notice tone="error">{teamError}</Notice> : null}
        {teamSuccess ? <Notice tone="success">{teamSuccess}</Notice> : null}
      </HelpBox>

      <HelpBox title="Conectar Google Calendar (opcional)">
        <p className="text-sm text-[#4d5a51]">
          Si usas Google Calendar, Levy copia allí las citas que agenda y, si quieres, respeta lo que ya
          tengas ocupado. Luego eliges el calendario en la <span className="font-medium">Agenda</span>.
        </p>
        <GoogleCalendarCard canManage />
      </HelpBox>

      <StepFooter onBack={ctx.goBack} onNext={ctx.goNext} />
    </div>
  );
}
