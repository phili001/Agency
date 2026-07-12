"use client";

import { Bot, Building2, CheckCircle2, KeyRound, Send, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildBusinessProfileContent,
  businessProfileFields,
  getBusinessProfileMetadata,
} from "@/lib/business-profile";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

type Checklist = {
  agentReady: boolean;
  businessReady: boolean;
  firstSignalReady: boolean;
  openaiReady: boolean;
  teamReady: boolean;
  ycloudReady: boolean;
};

type Workspace = {
  company_code?: string | null;
  id: string;
  name: string;
  onboarding_completed_at?: string | null;
  slug?: string;
};

type Integration = {
  config: Json;
  provider: "gohighlevel" | "openai" | "ycloud";
  status: string;
};

type Asset = {
  content: string;
  id: string;
  kind: string;
  metadata: Json;
  status: string;
  title: string;
};

export function OnboardingWizard({
  appUrl,
  checklist,
  integrations,
  workspace,
  workspaceCount,
  businessProfile,
}: {
  appUrl: string;
  businessProfile: Asset | null;
  checklist: Checklist | null;
  integrations: Integration[];
  workspace: Workspace | null;
  workspaceCount: number;
}) {
  const supabase = createClient();
  const [companyName, setCompanyName] = useState(workspace?.name ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState("");
  const activeWorkspace = workspace;
  const currentChecklist = checklist ?? {
    agentReady: false,
    businessReady: false,
    firstSignalReady: false,
    openaiReady: false,
    teamReady: false,
    ycloudReady: false,
  };
  const [businessFields, setBusinessFields] = useState(() => {
    const metadata = getBusinessProfileMetadata(businessProfile?.metadata ?? {});
    return metadata.fields ?? {};
  });
  const openaiIntegration = integrations.find((item) => item.provider === "openai");
  const ghlIntegration = integrations.find((item) => item.provider === "gohighlevel");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState(
    String(
      openaiIntegration?.config &&
        typeof openaiIntegration.config === "object" &&
        !Array.isArray(openaiIntegration.config) &&
        openaiIntegration.config.default_model
        ? openaiIntegration.config.default_model
        : "gpt-5.4-mini",
    ),
  );
  const [ycloudKey, setYcloudKey] = useState("");
  const [ycloudPhone, setYcloudPhone] = useState("");
  const [ycloudPhoneId, setYcloudPhoneId] = useState("");
  const [ycloudWabaId, setYcloudWabaId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [ghlKey, setGhlKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState(
    String(
      ghlIntegration?.config &&
        typeof ghlIntegration.config === "object" &&
        !Array.isArray(ghlIntegration.config) &&
        ghlIntegration.config.location_id
        ? ghlIntegration.config.location_id
        : "",
    ),
  );
  const webhookUrl = useMemo(() => {
    if (!activeWorkspace || !webhookSecret) {
      return "";
    }

    return `${appUrl.replace(/\/$/, "")}/api/webhooks/ycloud/${activeWorkspace.company_code ?? activeWorkspace.id}?secret=${encodeURIComponent(
      webhookSecret,
    )}`;
  }, [activeWorkspace, appUrl, webhookSecret]);
  const steps = [
    { done: Boolean(activeWorkspace), icon: Building2, label: "Empresa creada" },
    { done: currentChecklist.businessReady, icon: Building2, label: "Negocio completo" },
    { done: currentChecklist.openaiReady, icon: KeyRound, label: "OpenAI conectado" },
    { done: currentChecklist.ycloudReady, icon: Send, label: "YCloud conectado" },
    { done: Boolean(ghlIntegration), icon: KeyRound, label: "GHL opcional" },
    { done: currentChecklist.agentReady, icon: Bot, label: "Primer agente activo" },
    { done: currentChecklist.firstSignalReady, icon: Send, label: "Primer mensaje/webhook" },
    { done: currentChecklist.teamReady, icon: UsersRound, label: "Equipo invitado" },
  ];

  async function saveBusiness() {
    if (!activeWorkspace) {
      setStatus("Primero crea la empresa.");
      return;
    }

    setSaving("business");
    const metadata = { fields: businessFields };
    const payload = {
      content: buildBusinessProfileContent(metadata),
      kind: "business_profile",
      metadata,
      status: "active",
      title: businessFields.company_name || activeWorkspace.name,
      workspace_id: activeWorkspace.id,
    };
    const query = businessProfile?.id
      ? supabase
          .from("workspace_assets")
          .update(payload)
          .eq("id", businessProfile.id)
          .select("id")
          .single()
      : supabase.from("workspace_assets").insert(payload).select("id").single();
    const { error } = await query;

    setStatus(error ? error.message : "Perfil del negocio guardado.");
    setSaving("");
  }

  async function saveOpenAI() {
    if (!activeWorkspace) {
      setStatus("Primero crea la empresa.");
      return;
    }

    setSaving("openai");
    const response = await fetch("/api/integrations/openai", {
      body: JSON.stringify({
        apiKey: openaiKey,
        defaultModel: openaiModel,
        workspaceId: activeWorkspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    setStatus(response.ok ? "OpenAI conectado." : payload.error ?? "No se pudo conectar OpenAI.");
    setSaving("");
  }

  async function saveYCloud() {
    if (!activeWorkspace) {
      setStatus("Primero crea la empresa.");
      return;
    }

    setSaving("ycloud");
    const response = await fetch("/api/integrations/ycloud", {
      body: JSON.stringify({
        apiKey: ycloudKey,
        phoneE164: ycloudPhone,
        phoneId: ycloudPhoneId,
        wabaId: ycloudWabaId,
        webhookSecret,
        workspaceId: activeWorkspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      webhookSecret?: string;
      webhookUrl?: string;
    };

    if (payload.webhookSecret) {
      setWebhookSecret(payload.webhookSecret);
    }

    setStatus(response.ok ? "YCloud conectado." : payload.error ?? "No se pudo conectar YCloud.");
    setSaving("");
  }

  async function saveGoHighLevel() {
    if (!activeWorkspace) {
      setStatus("Primero crea la empresa.");
      return;
    }

    setSaving("gohighlevel");
    const response = await fetch("/api/integrations/gohighlevel", {
      body: JSON.stringify({
        apiKey: ghlKey,
        locationId: ghlLocationId,
        workspaceId: activeWorkspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    setStatus(response.ok ? "GoHighLevel conectado." : payload.error ?? "No se pudo conectar GoHighLevel.");
    setSaving("");
  }

  async function completeOnboarding() {
    if (!activeWorkspace) {
      return;
    }

    setSaving("complete");
    const response = await fetch("/api/workspaces", {
      body: JSON.stringify({
        action: "complete_onboarding",
        workspaceId: activeWorkspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "Todavia faltan pasos.");
      setSaving("");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] p-5 text-[#20231f]">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-[#d9ded3] bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#10231c] text-[#d2f36b]">
              <Bot size={21} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#647067]">
                Configuracion inicial
              </p>
              <h1 className="text-lg font-semibold">Primer agente WhatsApp</h1>
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            {steps.map((step) => (
              <div
                className="flex items-center justify-between rounded-lg border border-[#e2e6df] p-3 text-sm"
                key={step.label}
              >
                <span className="flex items-center gap-2">
                  <step.icon className="text-[#35735b]" size={16} />
                  {step.label}
                </span>
                <CheckCircle2
                  className={step.done ? "text-[#35735b]" : "text-[#c3cac2]"}
                  size={18}
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#647067]">
            {workspaceCount > 1
              ? "Tu correo ya pertenece a varias empresas. Luego podras cambiar desde el selector."
              : "Completa estos pasos una vez por cada empresa."}
          </p>
        </aside>

        <section className="grid gap-4">
          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="text-base font-semibold">
              1. Continua la configuracion de tu empresa
            </h2>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                className="h-11 flex-1 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                disabled
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Nombre de la empresa"
                value={activeWorkspace?.name ?? companyName}
              />
              <span className="inline-flex h-11 items-center justify-center rounded-lg bg-[#e7f6ce] px-4 text-sm font-semibold text-[#31521d]">
                {activeWorkspace ? "Empresa lista" : "Esperando asignacion"}
              </span>
            </div>
            {!activeWorkspace ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Tu cuenta aun no tiene una empresa asignada. Pide al administrador
                que la cree desde la consola superadmin.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="text-base font-semibold">2. Datos que usara el agente</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {businessProfileFields.slice(0, 8).map((field) => (
                <label className="grid gap-1.5 text-sm font-medium" key={field.key}>
                  {field.label}
                  <input
                    className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                    onChange={(event) =>
                      setBusinessFields((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    value={businessFields[field.key] ?? ""}
                  />
                </label>
              ))}
            </div>
            <button
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
              disabled={saving === "business"}
              onClick={saveBusiness}
              type="button"
            >
              Guardar negocio
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
              <h2 className="text-base font-semibold">3. Conecta OpenAI</h2>
              <div className="mt-3 grid gap-3">
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setOpenaiKey(event.target.value)}
                  placeholder="sk-..."
                  type="password"
                  value={openaiKey}
                />
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setOpenaiModel(event.target.value)}
                  value={openaiModel}
                />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                  disabled={saving === "openai"}
                  onClick={saveOpenAI}
                  type="button"
                >
                  Guardar OpenAI
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
              <h2 className="text-base font-semibold">4. Conecta YCloud</h2>
              <div className="mt-3 grid gap-3">
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setYcloudKey(event.target.value)}
                  placeholder="YCloud API key"
                  type="password"
                  value={ycloudKey}
                />
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setYcloudPhone(event.target.value)}
                  placeholder="+573001112233"
                  value={ycloudPhone}
                />
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setYcloudPhoneId(event.target.value)}
                  placeholder="Phone ID opcional"
                  value={ycloudPhoneId}
                />
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setYcloudWabaId(event.target.value)}
                  placeholder="WABA ID opcional"
                  value={ycloudWabaId}
                />
                <input
                  className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                  onChange={(event) => setWebhookSecret(event.target.value)}
                  placeholder="Secreto webhook, o dejalo vacio"
                  value={webhookSecret}
                />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                  disabled={saving === "ycloud"}
                  onClick={saveYCloud}
                  type="button"
                >
                  Guardar YCloud
                </button>
                {webhookUrl ? (
                  <p className="break-all rounded-lg border border-dashed border-[#cbd2c6] bg-[#fafbf8] p-3 text-xs text-[#4d5a51]">
                    Pega esta URL como webhook inbound en YCloud: {webhookUrl}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="text-base font-semibold">5. Conecta GoHighLevel opcional</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                onChange={(event) => setGhlKey(event.target.value)}
                placeholder="GoHighLevel API key"
                type="password"
                value={ghlKey}
              />
              <input
                className="h-10 rounded-lg border border-[#cbd2c6] px-3 outline-none"
                onChange={(event) => setGhlLocationId(event.target.value)}
                placeholder="Location ID"
                value={ghlLocationId}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={saving === "gohighlevel"}
                onClick={saveGoHighLevel}
                type="button"
              >
                Guardar GHL
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9ded3] bg-white p-4">
            <h2 className="text-base font-semibold">6. Equipo y salida</h2>
            <p className="mt-1 text-sm text-[#647067]">
              Puedes invitar trabajadores desde Equipo. Para finalizar, debe existir al
              menos un mensaje/webhook de prueba del numero conectado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
                href="/equipo"
              >
                Invitar equipo
              </a>
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white disabled:bg-[#9aa59e]"
                disabled={saving === "complete" || !activeWorkspace}
                onClick={completeOnboarding}
                type="button"
              >
                Entrar al dashboard
              </button>
            </div>
          </div>

          {status ? (
            <p className="rounded-lg bg-[#eef2eb] px-3 py-2 text-sm text-[#4d5a51]">
              {status}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
