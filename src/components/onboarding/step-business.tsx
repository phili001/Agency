"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type BusinessChoices,
  type BusinessLocation,
  attendModes,
  businessSectors,
  countries,
  getCountry,
  getSector,
  getTimeOptions,
  paymentOptions,
  policyOptions,
  weekdayPresets,
  weekdays,
  buildFieldsFromChoices,
  createLocation,
  getBusinessChoices,
  getCountryTimeZone,
  getFilledLocations,
} from "@/lib/business-choices";
import {
  buildBusinessProfileContent,
  getBusinessProfileMetadata,
} from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/client";
import {
  getBrowserTimeZone,
  getTimeZoneOptions,
  getZoneOffsetLabel,
} from "@/lib/timezones";

import {
  Chip,
  Field,
  HowTo,
  Notice,
  OptionCard,
  Question,
  StepFooter,
  StepHeading,
  inputClass,
} from "./shared";
import type { StepContext } from "./wizard";

const OTHER_CITY = "__otra__";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function StepBusiness({ ctx }: { ctx: StepContext }) {
  const supabase = createClient();
  const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);
  const timeOptions = useMemo(() => getTimeOptions(), []);
  // Lista de respaldo (país fuera del catálogo): "Madrid (Europe, GMT+2)",
  // ordenada por ciudad para poder buscarla de un vistazo.
  const timeZoneOptions = useMemo(
    () =>
      getTimeZoneOptions()
        .map((zone) => ({
          key: zone,
          label: `${zone.split("/").slice(1).join(" · ").replace(/_/g, " ") || zone} (${
            zone.split("/")[0]
          }, ${getZoneOffsetLabel(zone)})`,
        }))
        .sort((first, second) => first.label.localeCompare(second.label, "es")),
    [],
  );
  const savedMetadata = useMemo(
    () => getBusinessProfileMetadata(ctx.businessProfile?.metadata ?? {}),
    [ctx.businessProfile],
  );
  const [part, setPart] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showExtraServices, setShowExtraServices] = useState(false);
  const [showTimeZone, setShowTimeZone] = useState(false);
  const [name, setName] = useState(
    savedMetadata.fields?.company_name || ctx.workspace.name,
  );
  const [choices, setChoices] = useState<BusinessChoices>(() =>
    getBusinessChoices(savedMetadata.choices, browserTimeZone),
  );
  const sector = getSector(choices.sector);
  const country = getCountry(choices.country);
  const cityOptions = country?.cities ?? [];
  const countryZones = country?.timezones ?? [];
  // Filas donde el cliente eligió "Otra ciudad" y escribe a mano.
  const [freeCityIds, setFreeCityIds] = useState<string[]>(() =>
    getBusinessChoices(savedMetadata.choices, browserTimeZone)
      .locations.filter(
        (location) =>
          location.city && !(getCountry(choices.country)?.cities ?? []).includes(location.city),
      )
      .map((location) => location.id),
  );

  function patch(next: Partial<BusinessChoices>) {
    setChoices((current) => ({ ...current, ...next }));
  }

  function updateLocation(id: string, next: Partial<BusinessLocation>) {
    patch({
      locations: choices.locations.map((location) =>
        location.id === id ? { ...location, ...next } : location,
      ),
    });
  }

  function addLocation() {
    patch({ locations: [...choices.locations, createLocation()] });
  }

  function removeLocation(id: string) {
    patch({ locations: choices.locations.filter((location) => location.id !== id) });
    setFreeCityIds((current) => current.filter((item) => item !== id));
  }

  function selectSector(key: string) {
    const nextSector = getSector(key);
    // Al cambiar de sector se quedan solo los servicios que ese sector ofrece.
    patch({
      sector: key,
      services: choices.services.filter((service) =>
        nextSector?.services.includes(service),
      ),
    });
  }

  function selectCountry(key: string) {
    const nextCountry = getCountry(key);
    // Las ciudades del país anterior ya no valen: se vacían para volver a elegir.
    patch({
      country: key,
      locations: choices.locations.map((location) => ({
        ...location,
        city: nextCountry?.cities.includes(location.city) ? location.city : "",
      })),
      timezone: getCountryTimeZone(key, browserTimeZone),
    });
    setFreeCityIds(nextCountry?.cities.length ? [] : choices.locations.map((item) => item.id));
  }

  async function save() {
    setSaving(true);
    setError("");
    const fields = buildFieldsFromChoices(choices, {
      ...(savedMetadata.fields ?? {}),
      company_name: name.trim() || ctx.workspace.name,
    });
    const metadata = {
      choices: { ...choices },
      custom_fields: savedMetadata.custom_fields,
      fields,
    };
    const payload = {
      content: buildBusinessProfileContent(metadata),
      kind: "business_profile",
      metadata,
      status: "active",
      title: name.trim() || ctx.workspace.name,
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
      setError("No se pudo guardar. Revisa tu conexión a internet e inténtalo otra vez.");
      return false;
    }

    ctx.setBusinessProfile(data);
    ctx.patchChecklist({ businessReady: true });
    return true;
  }

  async function next() {
    if (part === 0) {
      if (!name.trim()) {
        setError("Escribe el nombre de tu negocio.");
        return;
      }

      if (!choices.sector) {
        setError("Elige a qué se dedica tu negocio.");
        return;
      }

      if (choices.services.length === 0 && !choices.servicesExtra.trim()) {
        setError("Marca al menos un servicio.");
        return;
      }

      if (choices.days.length === 0) {
        setError("Marca los días que atiendes.");
        return;
      }

      if (await save()) {
        setPart(1);
        window.scrollTo({ behavior: "smooth", top: 0 });
      }

      return;
    }

    if (choices.attendMode !== "online" && getFilledLocations(choices).length === 0) {
      setError(
        choices.attendMode === "domicilio"
          ? "Elige al menos una ciudad donde trabajas."
          : "Elige la ciudad de tu local.",
      );
      return;
    }

    if (await save()) {
      ctx.goNext();
    }
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 1 · Tu negocio"
        title={
          part === 0
            ? "Cuéntale a Levy sobre tu negocio"
            : "¿Dónde y cómo atiendes?"
        }
        description={
          part === 0
            ? "Casi todo es tocar botones. Con esto los agentes responden con datos reales y no inventan nada."
            : "Lo último del negocio. Marca lo que aplique y listo."
        }
      />

      <HowTo
        items={
          part === 0
            ? [
                <>Confirma el <span className="font-medium">nombre</span> de tu negocio.</>,
                <>Toca <span className="font-medium">a qué te dedicas</span> y marca los servicios que ofreces.</>,
                <>Marca los <span className="font-medium">días</span> y elige la hora de apertura y cierre.</>,
                <>Pulsa <span className="font-medium">Guardar y seguir</span>.</>,
              ]
            : [
                <>Elige tu <span className="font-medium">país</span> y cómo atiendes: en tu local, donde el cliente o solo online.</>,
                <>Elige la <span className="font-medium">ciudad</span> en la lista y, si tienes local, escribe la calle.</>,
                <>Marca cómo <span className="font-medium">te pagan</span> y tus <span className="font-medium">normas</span>. Pulsa Guardar y seguir.</>,
              ]
        }
      />

      {part === 0 ? (
        <div className="grid gap-6">
          <Question
            hint="Tal cual quieres que lo diga el agente en los chats."
            title="¿Cómo se llama tu negocio?"
          >
            <input
              className={inputClass}
              onChange={(event) => setName(event.target.value)}
              placeholder="Clínica Dental Norte"
              value={name}
            />
          </Question>

          <Question
            hint="Con esto preparamos la lista de servicios; después afinas."
            title="¿A qué se dedica?"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {businessSectors.map((item) => (
                <OptionCard
                  active={choices.sector === item.key}
                  key={item.key}
                  label={item.label}
                  onClick={() => selectSector(item.key)}
                />
              ))}
            </div>
          </Question>

          {choices.sector ? (
            <Question
              hint="Marca todo lo que ofreces. Puedes marcar varios."
              title="¿Qué ofreces?"
            >
              <div className="flex flex-wrap gap-2">
                {(sector?.services ?? []).map((service) => (
                  <Chip
                    active={choices.services.includes(service)}
                    key={service}
                    label={service}
                    onClick={() => patch({ services: toggle(choices.services, service) })}
                  />
                ))}
              </div>
              {showExtraServices || choices.servicesExtra ? (
                <Field
                  help="Sepáralos con comas. Solo si falta algo en la lista."
                  label="Otros servicios"
                  optional
                >
                  <input
                    className={inputClass}
                    onChange={(event) => patch({ servicesExtra: event.target.value })}
                    placeholder="Férulas de descarga, higiene infantil"
                    value={choices.servicesExtra}
                  />
                </Field>
              ) : (
                <button
                  className="justify-self-start text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
                  onClick={() => setShowExtraServices(true)}
                  type="button"
                >
                  + Añadir otro servicio que no está en la lista
                </button>
              )}
            </Question>
          ) : null}

          <Question
            hint="Toca los días y elige la hora. Es lo que más preguntan los clientes."
            title="¿Qué días y a qué hora atiendes?"
          >
            <div className="flex flex-wrap gap-2">
              {weekdayPresets.map((preset) => (
                <button
                  className="rounded-full border border-dashed border-[#cbd2c6] px-3 py-1.5 text-sm text-[#4d5a51] hover:border-[#35735b] hover:text-[#20231f]"
                  key={preset.label}
                  onClick={() => patch({ days: [...preset.days] })}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => (
                <button
                  aria-pressed={choices.days.includes(day.key)}
                  className={`size-12 rounded-xl border-2 text-sm font-semibold transition ${
                    choices.days.includes(day.key)
                      ? "border-[#10231c] bg-[#10231c] text-white"
                      : "border-[#e2e6df] bg-white text-[#4d5a51] hover:border-[#cbd2c6]"
                  }`}
                  key={day.key}
                  onClick={() => patch({ days: toggle(choices.days, day.key) })}
                  type="button"
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Abrimos a las">
                <select
                  className={inputClass}
                  onChange={(event) => patch({ openTime: event.target.value })}
                  value={choices.openTime}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cerramos a las">
                <select
                  className={inputClass}
                  onChange={(event) => patch({ closeTime: event.target.value })}
                  value={choices.closeTime}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Question>
        </div>
      ) : (
        <div className="grid gap-6">
          <Question title="¿En qué país está tu negocio?">
            <select
              className={inputClass}
              onChange={(event) => selectCountry(event.target.value)}
              value={choices.country}
            >
              <option value="">Elige tu país</option>
              {countries.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Question>

          <Question title="¿Cómo atiendes a tus clientes?">
            <div className="grid gap-2 sm:grid-cols-3">
              {attendModes.map((mode) => (
                <OptionCard
                  active={choices.attendMode === mode.key}
                  description={mode.description}
                  key={mode.key}
                  label={mode.label}
                  onClick={() => patch({ attendMode: mode.key })}
                />
              ))}
            </div>
          </Question>

          {choices.attendMode !== "online" ? (
            <Question
              hint={
                choices.attendMode === "domicilio"
                  ? "Las ciudades o zonas donde te mueves."
                  : "Si tienes más de un local, añádelos todos: el agente dirá a cuál ir."
              }
              title={
                choices.attendMode === "domicilio"
                  ? "¿En qué ciudades trabajas?"
                  : "¿Dónde está tu local?"
              }
            >
              <div className="grid gap-3">
                {choices.locations.map((location, index) => {
                  const freeCity =
                    cityOptions.length === 0 || freeCityIds.includes(location.id);
                  const several = choices.locations.length > 1;

                  return (
                    <div
                      className={
                        several
                          ? "grid gap-3 rounded-xl border border-[#e2e6df] bg-[#fafbf8] p-3"
                          : "grid gap-3"
                      }
                      key={location.id}
                    >
                      {several ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#20231f]">
                            {choices.attendMode === "domicilio"
                              ? `Ciudad ${index + 1}`
                              : location.venue.trim() || `Local ${index + 1}`}
                          </p>
                          <button
                            className="inline-flex items-center gap-1 text-sm font-medium text-[#8a5a12] underline-offset-4 hover:underline"
                            onClick={() => removeLocation(location.id)}
                            type="button"
                          >
                            <Trash2 size={14} />
                            Quitar
                          </button>
                        </div>
                      ) : null}

                      {freeCity ? (
                        <div className="grid gap-2">
                          <input
                            className={inputClass}
                            onChange={(event) =>
                              updateLocation(location.id, { city: event.target.value })
                            }
                            placeholder="Escribe la ciudad"
                            value={location.city}
                          />
                          {cityOptions.length > 0 ? (
                            <button
                              className="justify-self-start text-sm font-medium text-[#35735b] underline-offset-4 hover:underline"
                              onClick={() => {
                                setFreeCityIds((current) =>
                                  current.filter((item) => item !== location.id),
                                );
                                updateLocation(location.id, { city: "" });
                              }}
                              type="button"
                            >
                              Volver a la lista de ciudades
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <select
                          className={inputClass}
                          onChange={(event) => {
                            if (event.target.value === OTHER_CITY) {
                              setFreeCityIds((current) => [...current, location.id]);
                              updateLocation(location.id, { city: "" });
                              return;
                            }

                            updateLocation(location.id, { city: event.target.value });
                          }}
                          value={location.city}
                        >
                          <option value="">Elige la ciudad</option>
                          {cityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                          <option value={OTHER_CITY}>Otra ciudad…</option>
                        </select>
                      )}

                      {choices.attendMode === "local" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field help="Calle y número." label="Dirección" optional>
                            <input
                              className={inputClass}
                              onChange={(event) =>
                                updateLocation(location.id, { street: event.target.value })
                              }
                              placeholder="Calle Mayor 12, local 3"
                              value={location.street}
                            />
                          </Field>
                          <Field
                            help="Para que el agente sepa distinguir tus locales."
                            label="Nombre del local"
                            optional={!several}
                          >
                            <input
                              className={inputClass}
                              onChange={(event) =>
                                updateLocation(location.id, { venue: event.target.value })
                              }
                              placeholder="Sede Centro"
                              value={location.venue}
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                className="inline-flex items-center gap-1.5 justify-self-start rounded-full border border-dashed border-[#cbd2c6] px-3.5 py-2 text-sm font-medium text-[#4d5a51] hover:border-[#35735b] hover:text-[#20231f]"
                onClick={addLocation}
                type="button"
              >
                <Plus size={15} />
                {choices.attendMode === "domicilio"
                  ? "Añadir otra ciudad"
                  : "Añadir otro local"}
              </button>
            </Question>
          ) : null}

          <Question
            hint="Marca todas las que aceptes."
            optional
            title="¿Cómo te pueden pagar?"
          >
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((option) => (
                <Chip
                  active={choices.payments.includes(option)}
                  key={option}
                  label={option}
                  onClick={() => patch({ payments: toggle(choices.payments, option) })}
                />
              ))}
            </div>
          </Question>

          <Question
            hint="El agente las repetirá tal cual a tus clientes."
            optional
            title="¿Tienes alguna norma importante?"
          >
            <div className="flex flex-wrap gap-2">
              {policyOptions.map((option) => (
                <Chip
                  active={choices.policies.includes(option)}
                  key={option}
                  label={option}
                  onClick={() => patch({ policies: toggle(choices.policies, option) })}
                />
              ))}
            </div>
          </Question>

          <Question
            hint="Si usas una web para reservar, pégala aquí."
            optional
            title="Link para reservar"
          >
            <input
              className={inputClass}
              inputMode="url"
              onChange={(event) => patch({ bookingUrl: event.target.value })}
              placeholder="https://tunegocio.com/agenda"
              value={choices.bookingUrl}
            />
          </Question>

          <Question
            hint="Es la hora con la que el agente habla de citas y horarios."
            title="¿Con qué hora trabajas?"
          >
            {countryZones.length > 1 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {countryZones.map((zone) => (
                  <OptionCard
                    active={choices.timezone === zone.key}
                    description={getZoneOffsetLabel(zone.key)}
                    key={zone.key}
                    label={zone.label}
                    onClick={() => patch({ timezone: zone.key })}
                  />
                ))}
              </div>
            ) : null}

            {countryZones.length === 1 && !showTimeZone ? (
              <p className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e2e6df] bg-[#fafbf8] px-3 py-2.5">
                <span className="font-semibold text-[#20231f]">
                  {countryZones[0].label}
                </span>
                <span className="text-[#647067]">{getZoneOffsetLabel(countryZones[0].key)}</span>
                <button
                  className="font-medium text-[#35735b] underline-offset-4 hover:underline"
                  onClick={() => setShowTimeZone(true)}
                  type="button"
                >
                  Usar otra
                </button>
              </p>
            ) : null}

            {countryZones.length === 0 || showTimeZone ? (
              <Field
                help="Busca la ciudad más cercana a tu negocio."
                label="Zona horaria"
              >
                <select
                  className={inputClass}
                  onChange={(event) => patch({ timezone: event.target.value })}
                  value={choices.timezone}
                >
                  <option value="">Elige tu zona horaria</option>
                  {timeZoneOptions.map((zone) => (
                    <option key={zone.key} value={zone.key}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </Question>
        </div>
      )}

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
