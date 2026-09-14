"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  ConnectedBanner,
  Field,
  HelpBox,
  Notice,
  NumberedSteps,
  StepFooter,
  StepHeading,
  inputClass,
  linkButton,
  primaryButton,
  readApiError,
} from "./shared";
import { type StepContext, getIntegrationConfig } from "./wizard";

const DEFAULT_MODEL = "gpt-5.4-mini";

/** Traduce los errores mas comunes de OpenAI a algo accionable. */
function explainOpenAIError(message: string) {
  const text = message.toLowerCase();

  if (text.includes("incorrect api key") || text.includes("invalid_api_key") || text.includes("401")) {
    return "OpenAI no reconoce esa llave. Revisa que la copiaste completa (empieza por sk-) y que no tenga espacios.";
  }

  if (text.includes("insufficient_quota") || text.includes("exceeded your current quota")) {
    return "La llave es correcta pero tu cuenta de OpenAI no tiene saldo. Carga crédito en platform.openai.com → Billing y vuelve a probar.";
  }

  if (text.includes("model")) {
    return "OpenAI no aceptó el modelo elegido. Deja el modelo por defecto en Opciones avanzadas.";
  }

  return message;
}

export function StepOpenAI({ ctx }: { ctx: StepContext }) {
  const integration = ctx.integrations.find((item) => item.provider === "openai");
  const config = getIntegrationConfig(integration);
  const connected = integration?.status === "active";
  const [editing, setEditing] = useState(!connected);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(
    typeof config.default_model === "string" && config.default_model
      ? config.default_model
      : DEFAULT_MODEL,
  );
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function connectAndTest() {
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      setError("Pega la llave de OpenAI para continuar.");
      return;
    }

    if (!cleanKey.startsWith("sk-")) {
      setError("La llave de OpenAI empieza por sk-. Revisa que copiaste la correcta.");
      return;
    }

    setBusy("save");
    setError("");
    setSuccess("");
    const saveResponse = await fetch("/api/integrations/openai", {
      body: JSON.stringify({
        apiKey: cleanKey,
        defaultModel: model.trim() || DEFAULT_MODEL,
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!saveResponse.ok) {
      setError(await readApiError(saveResponse, "No se pudo guardar la llave."));
      setBusy("");
      return;
    }

    const { integration: saved } = (await saveResponse.json()) as {
      integration: { config: unknown; provider: "openai"; status: string };
    };
    ctx.upsertIntegration({
      config: saved.config as never,
      provider: "openai",
      status: saved.status,
    });
    ctx.patchChecklist({ openaiReady: true });
    setApiKey("");
    setBusy("test");
    await runTest();
  }

  async function runTest() {
    setBusy("test");
    setError("");
    setSuccess("");
    const response = await fetch("/api/integrations/openai/test", {
      body: JSON.stringify({ workspaceId: ctx.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setBusy("");

    if (!response.ok) {
      setError(explainOpenAIError(await readApiError(response, "OpenAI rechazó la prueba.")));
      setEditing(true);
      return;
    }

    setSuccess("La IA respondió. Todo en orden.");
    setEditing(false);
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 3 · El cerebro"
        title="Conecta la inteligencia que escribe las respuestas"
        description={
          <>
            Levy usa <span className="font-medium">OpenAI</span> (la empresa de ChatGPT)
            para redactar cada respuesta. Se paga por uso directamente a OpenAI, no a
            Levy. Solo necesitas pegar una llave.
          </>
        }
      />

      {connected && !editing ? (
        <ConnectedBanner
          action={
            <div className="flex flex-wrap gap-2">
              <button
                className={linkButton}
                disabled={busy !== ""}
                onClick={runTest}
                type="button"
              >
                {busy === "test" ? <Loader2 className="animate-spin" size={14} /> : null}
                Probar otra vez
              </button>
              <button className={linkButton} onClick={() => setEditing(true)} type="button">
                Cambiar llave
              </button>
            </div>
          }
          detail={
            typeof config.api_key_mask === "string"
              ? `Llave guardada: ${config.api_key_mask}`
              : "Llave guardada y cifrada."
          }
          title="OpenAI conectado"
        />
      ) : (
        <div className="grid gap-4">
          <Field
            help="Se guarda cifrada y solo se usa para los agentes de tu empresa."
            label="Llave de OpenAI (API key)"
          >
            <input
              autoComplete="off"
              className={inputClass}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
              value={apiKey}
            />
          </Field>

          <HelpBox title="¿Dónde consigo la llave?" defaultOpen={!connected}>
            <NumberedSteps
              items={[
                <>
                  Entra en{" "}
                  <a
                    className="font-medium text-[#35735b] underline"
                    href="https://platform.openai.com/api-keys"
                    rel="noreferrer"
                    target="_blank"
                  >
                    platform.openai.com/api-keys
                  </a>{" "}
                  e inicia sesión (o crea una cuenta).
                </>,
                <>
                  Pulsa <span className="font-medium">Create new secret key</span>. Ponle un
                  nombre, por ejemplo &quot;Levy&quot;.
                </>,
                <>
                  Copia la llave que aparece (empieza por <span className="font-medium">sk-</span>).
                  Solo se muestra una vez; si la pierdes, crea otra.
                </>,
                <>Pégala aquí arriba y pulsa &quot;Conectar y probar&quot;.</>,
              ]}
            />
            <p>
              Si tu cuenta es nueva, carga saldo en{" "}
              <span className="font-medium">Settings → Billing</span>. Con 5 USD alcanza
              para cientos de conversaciones.
            </p>
          </HelpBox>

          <HelpBox title="Opciones avanzadas">
            <Field help="Déjalo como está salvo que tu agencia te indique otro." label="Modelo de IA">
              <input
                className={inputClass}
                onChange={(event) => setModel(event.target.value)}
                value={model}
              />
            </Field>
          </HelpBox>

          <div>
            <button
              className={primaryButton}
              disabled={busy !== ""}
              onClick={connectAndTest}
              type="button"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
              {busy === "save"
                ? "Guardando…"
                : busy === "test"
                  ? "Probando…"
                  : "Conectar y probar"}
            </button>
          </div>
        </div>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <StepFooter
        nextDisabled={!ctx.checklist.openaiReady}
        onBack={ctx.goBack}
        onNext={ctx.goNext}
      />
    </div>
  );
}
