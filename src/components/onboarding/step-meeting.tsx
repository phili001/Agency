"use client";

import { CalendarCheck, Loader2, MessageCircleQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  type BookedMeeting,
  type MeetingDay,
  formatMeetingWhen,
} from "@/lib/onboarding-meeting";
import { SUPPORT_PHONE_DISPLAY, buildSupportLink, buildSupportMessage } from "@/lib/support";

import {
  ConnectedBanner,
  Field,
  HowTo,
  Notice,
  Question,
  StepFooter,
  StepHeading,
  inputClass,
  linkButton,
  primaryButton,
  readApiError,
  secondaryButton,
} from "./shared";
import type { StepContext } from "./wizard";

export function StepMeeting({ ctx }: { ctx: StepContext }) {
  const [days, setDays] = useState<MeetingDay[]>(ctx.meetingDays);
  const [meeting, setMeeting] = useState<BookedMeeting | null>(ctx.meeting);
  // Solo se espera cuando el servidor no pudo adelantar los huecos.
  const [loadingDays, setLoadingDays] = useState(
    ctx.meetingAvailable && !meeting && ctx.meetingDays.length === 0,
  );
  const [dateKey, setDateKey] = useState(ctx.meetingDays[0]?.dateKey ?? "");
  const [slot, setSlot] = useState("");
  const [phone, setPhone] = useState(ctx.meetingPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changing, setChanging] = useState(false);
  // El calendario no contesta (caído o sin permisos): se ofrece el WhatsApp.
  const [calendarDown, setCalendarDown] = useState(false);
  const timeZone = ctx.timeZone;

  useEffect(() => {
    if (!ctx.meetingAvailable || (ctx.meetingDays.length > 0 && !changing)) {
      return;
    }

    let cancelled = false;

    async function loadDays() {
      const response = await fetch(
        `/api/onboarding/meeting?workspaceId=${encodeURIComponent(
          ctx.workspace.id,
        )}&timezone=${encodeURIComponent(timeZone)}`,
        { cache: "no-store" },
      );

      if (cancelled) {
        return;
      }

      setLoadingDays(false);

      if (!response.ok) {
        setError("No pudimos cargar las horas libres. Inténtalo en un momento.");
        return;
      }

      const payload = (await response.json()) as { days: MeetingDay[]; error?: string };

      if (payload.error) {
        setCalendarDown(true);
        return;
      }

      setDays(payload.days);
      setDateKey((current) => current || payload.days[0]?.dateKey || "");
      ctx.setMeetingDays(payload.days);
    }

    void loadDays();

    return () => {
      cancelled = true;
    };
    // Se recarga al entrar al paso y al pulsar "Cambiar hora".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changing, ctx.meetingAvailable, ctx.workspace.id, timeZone]);

  const selectedDay = useMemo(
    () => days.find((day) => day.dateKey === dateKey) ?? days[0] ?? null,
    [dateKey, days],
  );

  async function book() {
    if (!slot) {
      setError("Elige una hora.");
      return;
    }

    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding/meeting", {
      body: JSON.stringify({
        action: "book",
        phone,
        startTime: slot,
        timezone: timeZone,
        workspaceId: ctx.workspace.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setBusy(false);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo agendar. Prueba con otra hora."));
      return;
    }

    const payload = (await response.json()) as { meeting: BookedMeeting };
    setMeeting(payload.meeting);
    ctx.setMeeting(payload.meeting);
    ctx.patchChecklist({ meetingReady: true });
    setChanging(false);
    setSlot("");
  }

  async function cancel() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding/meeting", {
      body: JSON.stringify({ action: "cancel", workspaceId: ctx.workspace.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setBusy(false);

    if (!response.ok) {
      setError(await readApiError(response, "No se pudo cambiar la hora."));
      return;
    }

    setMeeting(null);
    ctx.setMeeting(null);
    ctx.patchChecklist({ meetingReady: false });
    setChanging(true);
    setLoadingDays(days.length === 0);
  }

  if (!ctx.meetingAvailable || calendarDown) {
    const message = buildSupportMessage({
      companyName: ctx.workspace.name,
      stepIndex: 3,
      stepTitle: "Reunión con Levy",
    });

    return (
      <div className="grid gap-6">
        <StepHeading
          eyebrow="Paso 3 · Reunión con Levy"
          title="¿Prefieres que lo hagamos juntos?"
          description={
            calendarDown
              ? "La agenda no responde ahora mismo. Escríbenos y buscamos un hueco contigo; mientras tanto puedes seguir con la configuración."
              : "Los dos pasos siguientes piden dos llaves. Si no quieres hacerlo solo, escríbenos y lo configuramos contigo."
          }
        />
        <a
          className={`${primaryButton} justify-self-start`}
          href={buildSupportLink(message)}
          rel="noreferrer"
          target="_blank"
        >
          <MessageCircleQuestion size={18} />
          Escríbenos al {SUPPORT_PHONE_DISPLAY}
        </a>
        <StepFooter nextLabel="Seguir solo" onBack={ctx.goBack} onNext={ctx.goNext} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <StepHeading
        eyebrow="Paso 3 · Reunión con Levy"
        title={
          meeting && !changing
            ? "Tu puesta en marcha ya está agendada"
            : "Agenda tu puesta en marcha con nosotros"
        }
        description={
          meeting && !changing
            ? "Te esperamos ese día para dejar todo funcionando contigo. Recibirás la confirmación por correo."
            : "En los dos pasos siguientes hay que pegar dos llaves. Si prefieres que lo hagamos juntos, elige un hueco: son 30 minutos y lo dejamos listo."
        }
      />

      {meeting && !changing ? (
        <>
          <ConnectedBanner
            action={
              <button className={linkButton} disabled={busy} onClick={cancel} type="button">
                {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                Cambiar hora
              </button>
            }
            detail="Te llegará un correo con el enlace de la videollamada."
            title={formatMeetingWhen(meeting.startTime, meeting.timezone || timeZone)}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <StepFooter nextLabel="Siguiente" onBack={ctx.goBack} onNext={ctx.goNext} />
        </>
      ) : (
        <>
          <HowTo
            items={[
              <>Elige el <span className="font-medium">día</span> que mejor te venga.</>,
              <>Toca una <span className="font-medium">hora</span> de las libres.</>,
              <>Deja un <span className="font-medium">teléfono</span> por si hay que avisarte y pulsa Agendar.</>,
            ]}
          />

          {loadingDays ? (
            <p className="flex items-center gap-2 rounded-xl border border-[#e2e6df] bg-[#fafbf8] px-4 py-3 text-sm text-[#647067]">
              <Loader2 className="animate-spin" size={16} />
              Buscando horas libres…
            </p>
          ) : days.length === 0 ? (
            <Notice>
              Ahora mismo no hay huecos libres. Sigue con la configuración y
              escríbenos por WhatsApp cuando quieras: el contacto está aquí abajo.
            </Notice>
          ) : (
            <>
              <Question title="¿Qué día te viene bien?">
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <button
                      aria-pressed={day.dateKey === selectedDay?.dateKey}
                      className={`rounded-xl border-2 px-3.5 py-2.5 text-sm font-medium transition ${
                        day.dateKey === selectedDay?.dateKey
                          ? "border-[#10231c] bg-[#eef6df]"
                          : "border-[#e2e6df] bg-white hover:border-[#cbd2c6]"
                      }`}
                      key={day.dateKey}
                      onClick={() => {
                        setDateKey(day.dateKey);
                        setSlot("");
                      }}
                      type="button"
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </Question>

              <Question
                hint={`Horas en tu zona horaria (${timeZone}).`}
                title="¿A qué hora?"
              >
                <div className="flex flex-wrap gap-2">
                  {(selectedDay?.slots ?? []).map((item) => (
                    <button
                      aria-pressed={slot === item.iso}
                      className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold tabular-nums transition ${
                        slot === item.iso
                          ? "border-[#10231c] bg-[#10231c] text-white"
                          : "border-[#e2e6df] bg-white text-[#20231f] hover:border-[#35735b]"
                      }`}
                      key={item.iso}
                      onClick={() => setSlot(item.iso)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </Question>

              <Field
                help="Tu móvil, para avisarte o llamarte el día de la reunión. No es el número de WhatsApp de tu negocio."
                label="¿A qué teléfono te contactamos?"
              >
                <input
                  className={inputClass}
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+34 600 11 22 33"
                  value={phone}
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <button className={primaryButton} disabled={busy} onClick={book} type="button">
                  {busy ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <CalendarCheck size={18} />
                  )}
                  Agendar reunión
                </button>
                {changing ? (
                  <button
                    className={secondaryButton}
                    onClick={() => setChanging(false)}
                    type="button"
                  >
                    Dejar la hora que tenía
                  </button>
                ) : null}
              </div>
            </>
          )}

          {error ? <Notice tone="error">{error}</Notice> : null}

          <StepFooter
            nextLabel="Siguiente"
            onBack={ctx.goBack}
            onNext={ctx.goNext}
            secondary={
              <button className={secondaryButton} onClick={ctx.goNext} type="button">
                Prefiero hacerlo solo
              </button>
            }
          />
        </>
      )}
    </div>
  );
}
