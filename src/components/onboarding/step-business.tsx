"use client";

import { useMemo, useState } from "react";

import {
  buildBusinessProfileContent,
  businessProfileFields,
  getBusinessProfileMetadata,
} from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/client";
import { getBrowserTimeZone, getTimeZoneOptions } from "@/lib/timezones";

import { Field, HowTo, Notice, StepFooter, StepHeading, inputClass } from "./shared";
import type { StepContext } from "./wizard";

type FieldKey = (typeof businessProfileFields)[number]["key"];

/* Primero lo que el agente necesita si o si; el detalle va en una segunda pantalla. */
const basicKeys: FieldKey[] = ["company_name", "services", "business_hours", "location"];
const detailKeys: FieldKey[] = [
  "address",
  "team",
  "payment_methods",
  "policies",
  "booking_url",
  "country",
  "timezone",
];
const requiredKeys = new Set<FieldKey>(["company_name", "services", "business_hours"]);

/* Etiquetas en lenguaje de dueño de negocio; la clave tecnica no se muestra. */
const friendlyLabels: Partial<Record<FieldKey, string>> = {
  business_hours: "Horario de atención",
  company_name: "Nombre de tu negocio",
  location: "Ciudad o zona",
  services: "Qué vendes o qué servicios ofreces",
  team: "Personas del equipo que el agente puede nombrar",
};

export function StepBusiness({ ctx }: { ctx: StepContext }) {
  const supabase = createClient();
  const [part, setPart] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const metadata = getBusinessProfileMetadata(ctx.businessProfile?.metadata ?? {});
    const initial = { ...(metadata.fields ?? {}) };

    if (!initial.company_name) {
      initial.company_name = ctx.workspace.name;
    }

    if (!initial.timezone) {
      initial.timezone = getBrowserTimeZone();
    }

    return initial;
  });
  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), []);
  const missingRequired = [...requiredKeys].filter((key) => !fields[key]?.trim());

  function update(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const metadata = {
      custom_fields: getBusinessProfileMetadata(ctx.businessProfile?.metadata ?? {})
        .custom_fields,
      fields,
    };
    const payload = {
      content: buildBusinessProfileContent(metadata),
      kind: "business_profile",
      metadata,
      status: "active",
      title: fields.company_name?.trim() || ctx.workspace.name,
      workspace_id: ctx.workspace.id,
    };
    const query = ctx.businessProfile?.id
      ? supabase
          .from("workspace_assets")
          .update(payload)
          .eq("id", ctx.businessProfile.id)
          .select("id, kind, title, content, metadata, status")
          .single()
      : supabase
          .from("workspace_assets")
          .insert(payload)
          .select("id, kind, title, content, metadata, status")
          .single();
    const { data, error: saveError } = await query;

    setSaving(false);

    if (saveError || !data) {
      setError(
        "No se pudo guardar. Revisa tu conexión a internet e inténtalo otra vez.",
      );
      return false;
    }

    ctx.setBusinessProfile(data);
    ctx.patchChecklist({ businessReady: true });
    return true;
  }

  async function next() {
    if (part === 0) {
      if (missingRequired.length > 0) {
        setError("Completa los campos marcados para seguir.");
        return;
      }

      if (await save()) {
        setPart(1);
        window.scrollTo({ behavior: "smooth", top: 0 });
      }
      return;
    }

    if (await save()) {
      ctx.goNext();
    }
  }

  function renderField(key: FieldKey) {
    const definition = businessProfileFields.find((field) => field.key === key);

    if (!definition) {
      return null;
    }

    const label = friendlyLabels[key] ?? definition.label;
    const required = requiredKeys.has(key);
    const invalid = required && error && !fields[key]?.trim();

    if (key === "timezone") {
      return (
        <Field help={definition.help} key={key} label="Zona horaria">
          <select
            className={inputClass}
            onChange={(event) => update(key, event.target.value)}
            value={fields[key] ?? ""}
          >
            <option value="">Elige tu zona horaria</option>
            {timeZoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
      );
    }

    const multiline = ["services", "business_hours", "team", "policies", "payment_methods"].includes(
      key,
    );

    return (
      <Field help={definition.help} key={key} label={label} optional={!required}>
        {multiline ? (
          <textarea
            className={`${inputClass} h-auto min-h-24 py-3 ${invalid ? "border-[#b42318]" : ""}`}
            onChange={(event) => update(key, event.target.value)}
            placeholder={definition.placeholder}
            rows={3}
            value={fields[key] ?? ""}
          />
        ) : (
          <input
            className={`${inputClass} ${invalid ? "border-[#b42318]" : ""}`}
            onChange={(event) => update(key, event.target.value)}
            placeholder={definition.placeholder}
            value={fields[key] ?? ""}
          />
        )}
      </Field>
    );
  }

  return (
    <div className="grid gap-6">
      {part === 0 ? (
        <StepHeading
          eyebrow="Paso 1 · Tu negocio"
          title="Cuéntale a Levy sobre tu negocio"
          description="Con esto los agentes responden con datos reales: nada de inventar horarios ni servicios. Escribe como se lo contarías a un empleado nuevo."
        />
      ) : (
        <StepHeading
          eyebrow="Paso 1 · Tu negocio"
          title="Unos detalles más (puedes saltarlos)"
          description="Cuanto más sepa Levy, mejor responde. Todo esto se puede completar después desde la sección Negocio."
        />
      )}

      {part === 0 ? (
        <HowTo
          items={[
            <>Escribe el <span className="font-medium">nombre</span> de tu negocio tal como quieres que lo diga el agente.</>,
            <>Cuenta <span className="font-medium">qué vendes</span> y tu <span className="font-medium">horario</span>: son los dos datos que más preguntan los clientes.</>,
            <>Pon la ciudad o zona (opcional) y pulsa <span className="font-medium">Guardar y seguir</span>.</>,
          ]}
        />
      ) : (
        <HowTo
          items={[
            <>Rellena solo lo que aplique a tu negocio; lo demás déjalo vacío.</>,
            <>Elige tu <span className="font-medium">zona horaria</span> en la lista: es la que usa el agente para hablar de fechas y citas.</>,
            <>Pulsa <span className="font-medium">Guardar y seguir</span>. Podrás cambiar todo esto después en la sección Negocio.</>,
          ]}
        />
      )}

      <div className="grid gap-5">
        {(part === 0 ? basicKeys : detailKeys).map(renderField)}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <StepFooter
        busy={saving}
        nextLabel="Guardar y seguir"
        onBack={part === 0 ? ctx.goBack : () => setPart(0)}
        onNext={next}
      />
    </div>
  );
}
