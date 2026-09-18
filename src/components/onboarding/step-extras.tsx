"use client";

import { CalendarCheck, Check, CircleX, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

import {
  ConnectedBanner,
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
import { type StepContext, getIntegrationConfig } from "./wizard";

const roleOptions = [
  { description: "Responde chats y ve los clientes.", label: "Atiende chats", value: "agent" },
  { description: "Puede configurar todo, como tú.", label: "Administra", value: "admin" },
  { description: "Solo mira, no puede escribir.", label: "Solo mira", value: "viewer" },
] as const;

type TestStep = { detail?: string; key: string; label: string; status: "passed" | "failed" };

export function StepExtras({ ctx }: { ctx: StepContext }) {
  const ghl = ctx.integrations.find((item) => item.provider === "gohighlevel");
  const ghlConfig = getIntegrationConfig(ghl);
  const ghlConnected = ghl?.status === "active";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("agent");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");

  const [ghlEditing, setGhlEditing] = useState(!ghlConnected);
  const [ghlKey, setGhlKey] = useState("");
  const [ghlLocation, setGhlLocation] = useState(
    typeof ghlConfig.location_id === "string" ? ghlConfig.location_id : "",
  );
  const [ghlBusy, setGhlBusy] = useState<"" | "save" | "test">("");
  const [ghlError, setGhlError] = useState("");
  const [ghlSteps, setGhlSteps] = useState<TestStep[]>([]);
  const [ghlSuccess, setGhlSuccess] = useState("");

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

  async function connectGhl() {
    if (!ghlLocation.trim()) {
      setGhlError("Falta el Location ID de tu cuenta de GoHighLevel.");
      return;
    }

    if (!ghlKey.trim() && !ghlConnected) {
      setGhlError("Pega el token de integración privada de GoHighLevel.");
      return;
    }

    setGhlBusy("save");
    setGhlError("");
    setGhlSuccess("");
    setGhlSteps([]);
    const response = await fetch("/api/integrations/gohighlevel", {
      body: JSON.stringify({
        apiKey: ghlKey.trim(),
        locationId: ghlLocation.trim(),
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setGhlError(await readApiError(response, "No se pudo conectar GoHighLevel."));
      setGhlBusy("");
      return;
    }

    const payload = (await response.json()) as {
      integration?: { config: unknown; status: string };
    };

    if (payload.integration) {
      ctx.upsertIntegration({
        config: payload.integration.config as never,
        provider: "gohighlevel",
        status: payload.integration.status,
      });
    }

    setGhlKey("");
    setGhlBusy("test");
    const testResponse = await fetch("/api/integrations/gohighlevel/test", {
      body: JSON.stringify({ workspaceId: ctx.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const testPayload = (await testResponse.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      steps?: TestStep[];
    };
    setGhlBusy("");
    setGhlSteps(testPayload.steps ?? []);

    if (!testResponse.ok) {
      setGhlError(
        testPayload.error ??
          "GoHighLevel quedó guardado, pero la prueba de citas falló. Revisa los permisos del token.",
      );
      return;
    }

    setGhlSuccess("GoHighLevel conectado: Levy pudo crear y borrar una cita de prueba.");
    setGhlEditing(false);
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
          <>Abre la caja que te interese: <span className="font-medium">Invitar a tu equipo</span> o <span className="font-medium">Conectar GoHighLevel</span>.</>,
          <>Rellena lo que pide y pulsa su botón (Invitar / Conectar y probar citas). Puedes repetirlo para varias personas.</>,
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

      <HelpBox defaultOpen={ghlConnected} title="Conectar GoHighLevel (solo si ya lo usas)">
        <p>
          GoHighLevel es un programa de agenda y clientes (CRM). Si tu negocio lo usa,
          Levy puede agendar citas directamente en tu calendario y guardar allí cada
          contacto.{" "}
          <span className="font-medium">Si no sabes qué es, sáltalo sin problema.</span>
        </p>

        {ghlConnected && !ghlEditing ? (
          <ConnectedBanner
            action={
              <button
                className="text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
                onClick={() => setGhlEditing(true)}
                type="button"
              >
                Cambiar datos
              </button>
            }
            detail="Los calendarios se eligen luego en Tools y se asignan a cada agente."
            title="GoHighLevel conectado"
          />
        ) : (
          <div className="grid gap-3">
            <Field
              help="En GoHighLevel: Settings → Business Profile. Es el identificador de la subcuenta de tu negocio."
              label="Location ID"
            >
              <input
                className={inputClass}
                onChange={(event) => setGhlLocation(event.target.value)}
                placeholder="Ej: ve9EPM428h8vShlRW1KT"
                value={ghlLocation}
              />
            </Field>
            <Field
              help="En GoHighLevel: Settings → Private Integrations → Create new Integration. No sirve la API Key antigua."
              label="Token de integración privada"
            >
              <input
                autoComplete="off"
                className={inputClass}
                onChange={(event) => setGhlKey(event.target.value)}
                placeholder={ghlConnected ? "Déjalo vacío para conservar el actual" : "pit-…"}
                type="password"
                value={ghlKey}
              />
            </Field>
            <HelpBox title="Permisos que debe tener el token">
              <NumberedSteps
                items={[
                  <>View Contacts y Edit Contacts</>,
                  <>View Calendars</>,
                  <>View Calendar Events y Edit Calendar Events</>,
                  <>View Locations</>,
                ]}
              />
            </HelpBox>
            <div>
              <button
                className={primaryButton}
                disabled={ghlBusy !== ""}
                onClick={connectGhl}
                type="button"
              >
                {ghlBusy ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CalendarCheck size={18} />
                )}
                {ghlBusy === "save"
                  ? "Guardando…"
                  : ghlBusy === "test"
                    ? "Probando citas…"
                    : "Conectar y probar citas"}
              </button>
            </div>
          </div>
        )}

        {ghlSteps.length > 0 ? (
          <div className="grid gap-1 rounded-lg border border-[#e2e6df] bg-white p-3">
            {ghlSteps.map((step) => (
              <div className="grid grid-cols-[18px_1fr] items-start gap-2 text-xs" key={step.key}>
                {step.status === "passed" ? (
                  <Check className="mt-0.5 text-[#35735b]" size={15} />
                ) : (
                  <CircleX className="mt-0.5 text-[#b42318]" size={15} />
                )}
                <p className="text-[#334139]">
                  <span className="font-medium">{step.label}</span>
                  {step.detail ? `: ${step.detail}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {ghlError ? <Notice tone="error">{ghlError}</Notice> : null}
        {ghlSuccess ? <Notice tone="success">{ghlSuccess}</Notice> : null}
      </HelpBox>

      <StepFooter onBack={ctx.goBack} onNext={ctx.goNext} />
    </div>
  );
}
