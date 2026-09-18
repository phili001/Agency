"use client";

import { Loader2, PlugZap, Send } from "lucide-react";
import { useState } from "react";

import {
  ConnectedBanner,
  CopyButton,
  Field,
  HelpBox,
  HowTo,
  Notice,
  NumberedSteps,
  StepFooter,
  StepHeading,
  inputClass,
  linkButton,
  primaryButton,
  readApiError,
  secondaryButton,
} from "./shared";
import { type StepContext, getIntegrationConfig } from "./wizard";

function explainYCloudError(message: string) {
  const text = message.toLowerCase();

  if (text.includes("401") || text.includes("unauthorized") || text.includes("api key")) {
    return "YCloud no reconoce esa llave. Revisa que la copiaste completa desde Developers → API Keys.";
  }

  return message;
}

export function StepWhatsApp({ ctx }: { ctx: StepContext }) {
  const integration = ctx.integrations.find((item) => item.provider === "ycloud");
  const config = getIntegrationConfig(integration);
  const connected = integration?.status === "active";
  const savedPhone = typeof config.phone_e164 === "string" ? config.phone_e164 : "";
  const [editing, setEditing] = useState(!connected);
  const [apiKey, setApiKey] = useState("");
  const [phone, setPhone] = useState(savedPhone);
  const [wabaId, setWabaId] = useState(
    typeof config.waba_id === "string" ? config.waba_id : "",
  );
  const [phoneId, setPhoneId] = useState(
    typeof config.phone_id === "string" ? config.phone_id : "",
  );
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save() {
    const cleanKey = apiKey.trim();
    const cleanPhone = phone.trim().replace(/[\s-]/g, "");

    if (!cleanKey) {
      setError("Pega la llave de YCloud para continuar.");
      return;
    }

    if (!/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      setError(
        "Escribe el número con el signo + y el código de país, sin espacios. Ejemplo: +573001112233.",
      );
      return;
    }

    setBusy("save");
    setError("");
    setSuccess("");
    const response = await fetch("/api/integrations/ycloud", {
      body: JSON.stringify({
        apiKey: cleanKey,
        phoneE164: cleanPhone,
        phoneId: phoneId.trim(),
        wabaId: wabaId.trim(),
        webhookSecret: webhookSecret.trim(),
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo guardar YCloud."));
      setBusy("");
      return;
    }

    const payload = (await response.json()) as {
      integration: { config: unknown; status: string };
      webhookUrl?: string;
    };
    ctx.upsertIntegration({
      config: payload.integration.config as never,
      provider: "ycloud",
      status: payload.integration.status,
    });
    ctx.setWebhookUrl(payload.webhookUrl ?? null);
    ctx.patchChecklist({ ycloudReady: true });
    setApiKey("");
    setWebhookSecret("");
    setEditing(false);
    setBusy("");
    setSuccess("Datos guardados. Ahora pega la dirección de abajo en YCloud.");
  }

  async function test() {
    setBusy("test");
    setError("");
    setSuccess("");
    const response = await fetch("/api/integrations/ycloud/test", {
      body: JSON.stringify({ workspaceId: ctx.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setBusy("");

    if (!response.ok) {
      setError(explainYCloudError(await readApiError(response, "YCloud rechazó la prueba.")));
      return;
    }

    setSuccess("YCloud respondió. La llave funciona.");
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 4 · Tu WhatsApp"
        title="Conecta tu número de WhatsApp"
        description={
          <>
            Tu número vive en <span className="font-medium">YCloud</span>, el servicio
            que lo une con WhatsApp. Aquí le decimos a Levy cuál es y cómo hablar con él.
          </>
        }
      />

      <HowTo
        items={[
          <>Pega la <span className="font-medium">llave de YCloud</span> (abre "¿Dónde consigo la llave?" si no sabes sacarla).</>,
          <>Escribe tu <span className="font-medium">número de WhatsApp</span> con + y código de país.</>,
          <>Pulsa <span className="font-medium">Guardar y conectar</span>.</>,
          <>Aparecerá una dirección: cópiala y pégala en YCloud siguiendo los 4 pasos que se muestran. Sin esto los mensajes no llegan.</>,
          <>Pulsa <span className="font-medium">Siguiente</span> para comprobarlo con un mensaje real.</>,
        ]}
      />

      {connected && !editing ? (
        <ConnectedBanner
          action={
            <div className="flex flex-wrap gap-2">
              <button className={linkButton} disabled={busy !== ""} onClick={test} type="button">
                {busy === "test" ? <Loader2 className="animate-spin" size={14} /> : null}
                Probar conexión
              </button>
              <button className={linkButton} onClick={() => setEditing(true)} type="button">
                Cambiar datos
              </button>
            </div>
          }
          detail={savedPhone ? `Número conectado: ${savedPhone}` : "Llave guardada y cifrada."}
          title="WhatsApp conectado"
        />
      ) : (
        <div className="grid gap-4">
          <Field
            help="Se guarda cifrada y solo se usa para enviar mensajes desde tu número."
            label="Llave de YCloud (API key)"
          >
            <input
              autoComplete="off"
              className={inputClass}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Pega aquí la llave"
              type="password"
              value={apiKey}
            />
          </Field>
          <Field
            help="El mismo número que aparece en YCloud, con + y código de país."
            label="Tu número de WhatsApp"
          >
            <input
              className={inputClass}
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+573001112233"
              value={phone}
            />
          </Field>

          <HelpBox title="¿Dónde consigo la llave de YCloud?" defaultOpen={!connected}>
            <NumberedSteps
              items={[
                <>
                  Entra en{" "}
                  <a
                    className="font-medium text-[#35735b] underline"
                    href="https://www.ycloud.com"
                    rel="noreferrer"
                    target="_blank"
                  >
                    ycloud.com
                  </a>{" "}
                  con tu usuario.
                </>,
                <>
                  En el menú de la izquierda ve a{" "}
                  <span className="font-medium">Developers → API Keys</span>.
                </>,
                <>
                  Crea una llave (o copia la que ya existe) y pégala aquí arriba.
                </>,
              ]}
            />
          </HelpBox>

          <HelpBox title="Opciones avanzadas (normalmente no hacen falta)">
            <Field
              help="WhatsApp Business Account ID. Sale en YCloud → WhatsApp Accounts. Ayuda si tienes varios números."
              label="WABA ID"
              optional
            >
              <input
                className={inputClass}
                onChange={(event) => setWabaId(event.target.value)}
                placeholder="123456789012345"
                value={wabaId}
              />
            </Field>
            <Field
              help="Identificador técnico del número. Si YCloud no lo muestra, déjalo vacío."
              label="Phone ID"
              optional
            >
              <input
                className={inputClass}
                onChange={(event) => setPhoneId(event.target.value)}
                placeholder="Opcional"
                value={phoneId}
              />
            </Field>
            <Field
              help="Contraseña interna que protege la dirección de recepción. Si lo dejas vacío, Levy genera uno seguro."
              label="Secreto del webhook"
              optional
            >
              <input
                autoComplete="off"
                className={inputClass}
                onChange={(event) => setWebhookSecret(event.target.value)}
                placeholder="Déjalo vacío para generarlo automáticamente"
                value={webhookSecret}
              />
            </Field>
          </HelpBox>

          <div className="flex flex-wrap gap-2">
            <button className={primaryButton} disabled={busy !== ""} onClick={save} type="button">
              {busy === "save" ? <Loader2 className="animate-spin" size={18} /> : <PlugZap size={18} />}
              {busy === "save" ? "Guardando…" : "Guardar y conectar"}
            </button>
            {connected ? (
              <button className={secondaryButton} onClick={() => setEditing(false)} type="button">
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {connected && ctx.webhookUrl ? (
        <div className="grid gap-3 rounded-xl border-2 border-[#10231c] bg-[#fafbf8] p-4">
          <div className="flex items-center gap-2">
            <Send className="text-[#35735b]" size={18} />
            <h3 className="text-base font-semibold">
              Último paso: dile a YCloud dónde enviar los mensajes
            </h3>
          </div>
          <p className="text-sm text-[#4d5a51]">
            Sin esto, los mensajes de tus clientes no llegan a Levy. Copia esta
            dirección y pégala en YCloud siguiendo los pasos.
          </p>
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#cbd2c6] bg-white p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all text-xs text-[#20231f]">
              {ctx.webhookUrl}
            </code>
            <CopyButton label="Copiar dirección" value={ctx.webhookUrl} />
          </div>
          <NumberedSteps
            items={[
              <>
                En YCloud ve a <span className="font-medium">Developers → Webhooks</span> y
                pulsa <span className="font-medium">Add endpoint</span> (o edita el que ya existe).
              </>,
              <>
                En <span className="font-medium">Endpoint URL</span> pega la dirección que
                acabas de copiar.
              </>,
              <>
                Marca los eventos de WhatsApp de{" "}
                <span className="font-medium">mensaje recibido</span> (inbound message) y{" "}
                <span className="font-medium">estado de mensaje</span> (message updated).
              </>,
              <>Guarda. En el siguiente paso comprobamos que todo llega.</>,
            ]}
          />
        </div>
      ) : null}

      <StepFooter
        nextDisabled={!ctx.checklist.ycloudReady}
        onBack={ctx.goBack}
        onNext={ctx.goNext}
      />
    </div>
  );
}
