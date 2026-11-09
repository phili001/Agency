"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  Plus,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  SUPPORT_PHONE_DISPLAY,
  buildSupportLink,
  buildSupportMessage,
} from "@/lib/support";

/*
 * Piezas que comparten todos los pasos del wizard. Estan pensadas para gente
 * sin experiencia: texto grande, un boton principal por pantalla y la palabra
 * tecnica siempre entre parentesis o dentro de un desplegable.
 */

export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-5 text-base font-bold text-ink transition hover:bg-yellow-strong disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-base font-medium text-ink transition hover:bg-paper-2 disabled:cursor-not-allowed disabled:text-faint";

export const linkButton =
  "inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline disabled:text-faint";

export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-yellow/50 disabled:bg-paper-2";

export function StepHeading({
  eyebrow,
  title,
  description,
}: {
  description?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-2xl font-semibold leading-tight text-ink md:text-3xl">
        {title}
      </h2>
      {description ? (
        <div className="mt-3 text-base leading-relaxed text-ink-2">{description}</div>
      ) : null}
    </div>
  );
}

export function Field({
  children,
  help,
  label,
  optional,
}: {
  children: ReactNode;
  help?: ReactNode;
  label: string;
  optional?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-base font-medium text-ink">
        {label}
        {optional ? (
          <span className="ml-2 text-sm font-normal text-muted">opcional</span>
        ) : null}
      </span>
      {children}
      {help ? <span className="text-sm text-muted">{help}</span> : null}
    </label>
  );
}

/** Desplegable "¿Qué es esto?" para no asustar con jerga en la primera vista. */
export function HelpBox({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-line bg-paper-2">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-medium text-ink"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {title}
        <ChevronDown
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          size={18}
        />
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-line px-4 py-3 text-sm leading-relaxed text-ink-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Lista numerada para instrucciones tipo "ve a X, luego a Y". */
export function NumberedSteps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((item, index) => (
        <li className="flex gap-3" key={index}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-yellow-soft text-xs font-semibold text-ink">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Cómo completar este paso": la misma caja, siempre abierta, en cada pantalla. */
export function HowTo({ items, title = "Cómo completar este paso" }: { items: ReactNode[]; title?: string }) {
  return (
    <div className="grid gap-3 rounded-xl border border-yellow-strong bg-yellow-soft p-4">
      <p className="flex items-center gap-2 text-base font-semibold text-ink">
        <ListChecks className="text-ink" size={18} />
        {title}
      </p>
      <div className="text-sm leading-relaxed text-ink-2">
        <NumberedSteps items={items} />
      </div>
    </div>
  );
}

/**
 * Salida humana en cada paso. El mensaje de WhatsApp va preescrito pidiendo
 * una persona y con el paso actual, para que quede en el resumen del handoff.
 */
export function SupportContact({
  companyName,
  stepIndex,
  stepTitle,
}: {
  companyName: string;
  stepIndex: number | null;
  stepTitle: string;
}) {
  const message = buildSupportMessage({ companyName, stepIndex, stepTitle });

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow-soft text-ink">
          <MessageCircleQuestion size={20} />
        </span>
        <div className="text-sm leading-relaxed text-ink-2">
          <p className="text-base font-semibold text-ink">
            ¿Te confundiste en este paso? Escríbenos, sin pena.
          </p>
          <p className="mt-1">
            WhatsApp <span className="font-semibold text-ink">{SUPPORT_PHONE_DISPLAY}</span>.
            Para que te atienda una persona, di en el mensaje que{" "}
            <span className="font-medium">quieres hablar con una persona</span> y en qué paso
            estás; así le queda en el resumen a quien te atienda.
          </p>
        </div>
      </div>
      <a
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-ink px-4 text-sm font-semibold text-ink transition hover:bg-yellow-soft"
        href={buildSupportLink(message)}
        rel="noreferrer"
        target="_blank"
      >
        Escribir por WhatsApp
      </a>
    </aside>
  );
}

/** Tarjeta grande de una sola elección: se toca, no se escribe. */
export function OptionCard({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`grid content-start gap-1 rounded-xl border-2 p-3 text-left transition ${
        active
          ? "border-ink bg-yellow-soft"
          : "border-line bg-white hover:border-line"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="text-sm font-semibold leading-snug text-ink">{label}</span>
      {description ? (
        <span className="text-xs leading-relaxed text-ink-2">{description}</span>
      ) : null}
    </button>
  );
}

/** Botón-pastilla para marcar varias cosas a la vez. */
export function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-white text-ink hover:border-ink"
      }`}
      onClick={onClick}
      type="button"
    >
      {active ? <Check size={14} /> : <Plus size={14} />}
      {label}
    </button>
  );
}

/** Bloque de pregunta: título corto arriba y los botones debajo. */
export function Question({
  children,
  hint,
  optional,
  title,
}: {
  children: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  title: string;
}) {
  return (
    <div className="grid gap-2.5">
      <div>
        <h3 className="text-base font-semibold text-ink">
          {title}
          {optional ? (
            <span className="ml-2 text-sm font-normal text-muted">opcional</span>
          ) : null}
        </h3>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Interruptor de encendido/apagado, para activar o pausar un agente. */
export function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? "bg-ink" : "bg-line"
      }`}
      onClick={onChange}
      type="button"
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  children: ReactNode;
  tone: "done" | "pending" | "error";
}) {
  const classes =
    tone === "done"
      ? "bg-yellow-soft text-ink"
      : tone === "error"
        ? "bg-[#f8dcd6] text-[#7a2f1d]"
        : "bg-paper-2 text-ink-2";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${classes}`}
    >
      {tone === "done" ? <Check size={14} /> : null}
      {children}
    </span>
  );
}

export function ConnectedBanner({
  action,
  detail,
  title,
}: {
  action?: ReactNode;
  detail?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-strong bg-yellow-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <Check size={18} />
        </span>
        <div>
          <p className="text-base font-semibold text-ink">{title}</p>
          {detail ? <p className="mt-0.5 text-sm text-ink-2">{detail}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const classes =
    tone === "error"
      ? "border-[#f0c4bb] bg-[#fdf1ee] text-[#7a2f1d]"
      : tone === "success"
        ? "border-yellow-strong bg-yellow-soft text-ink"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${classes}`} role="status">
      {children}
    </div>
  );
}

export function CopyButton({ label = "Copiar", value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto sigue visible para copiarlo a mano.
      setCopied(false);
    }
  }

  return (
    <button
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-yellow shadow-[inset_0_0_0_1.5px_var(--color-ink)] px-3 text-sm font-bold text-ink"
      onClick={copy}
      type="button"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copiado" : label}
    </button>
  );
}

export function StepFooter({
  busy,
  nextDisabled,
  nextLabel = "Siguiente",
  onBack,
  onNext,
  secondary,
}: {
  busy?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  onBack?: () => void;
  onNext: () => void;
  secondary?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {onBack ? (
          <button className={secondaryButton} onClick={onBack} type="button">
            <ArrowLeft size={18} />
            Atrás
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {secondary}
        <button
          className={primaryButton}
          disabled={busy || nextDisabled}
          onClick={onNext}
          type="button"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          {nextLabel}
          {!busy ? <ArrowRight size={18} /> : null}
        </button>
      </div>
    </div>
  );
}

/** Lee `{ error }` de una respuesta de API sin romper si no es JSON. */
export async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
