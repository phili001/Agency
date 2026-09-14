"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Loader2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

/*
 * Piezas que comparten todos los pasos del wizard. Estan pensadas para gente
 * sin experiencia: texto grande, un boton principal por pantalla y la palabra
 * tecnica siempre entre parentesis o dentro de un desplegable.
 */

export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#10231c] px-5 text-base font-semibold text-white transition hover:bg-[#1b3a2f] disabled:cursor-not-allowed disabled:bg-[#9aa59e]";

export const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cbd2c6] bg-white px-5 text-base font-medium text-[#20231f] transition hover:bg-[#f6f7f3] disabled:cursor-not-allowed disabled:text-[#9aa59e]";

export const linkButton =
  "inline-flex items-center gap-1.5 text-sm font-medium text-[#35735b] underline-offset-4 hover:underline disabled:text-[#9aa59e]";

export const inputClass =
  "h-12 w-full rounded-xl border border-[#cbd2c6] bg-white px-4 text-base outline-none transition focus:border-[#35735b] focus:ring-2 focus:ring-[#d2f36b]/50 disabled:bg-[#f3f4ef]";

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
        <p className="text-xs font-semibold uppercase tracking-wide text-[#647067]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-2xl font-semibold leading-tight text-[#20231f] md:text-3xl">
        {title}
      </h2>
      {description ? (
        <div className="mt-3 text-base leading-relaxed text-[#4d5a51]">{description}</div>
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
      <span className="text-base font-medium text-[#20231f]">
        {label}
        {optional ? (
          <span className="ml-2 text-sm font-normal text-[#7a847c]">opcional</span>
        ) : null}
      </span>
      {children}
      {help ? <span className="text-sm text-[#647067]">{help}</span> : null}
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
    <div className="rounded-xl border border-[#d9ded3] bg-[#fafbf8]">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-medium text-[#20231f]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {title}
        <ChevronDown
          className={`shrink-0 text-[#647067] transition ${open ? "rotate-180" : ""}`}
          size={18}
        />
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-[#e2e6df] px-4 py-3 text-sm leading-relaxed text-[#4d5a51]">
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
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e7f6ce] text-xs font-semibold text-[#31521d]">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ol>
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
      ? "bg-[#e7f6ce] text-[#31521d]"
      : tone === "error"
        ? "bg-[#f8dcd6] text-[#7a2f1d]"
        : "bg-[#eef2eb] text-[#4d5a51]";

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b9dc9c] bg-[#eef6df] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#35735b] text-white">
          <Check size={18} />
        </span>
        <div>
          <p className="text-base font-semibold text-[#20231f]">{title}</p>
          {detail ? <p className="mt-0.5 text-sm text-[#4d5a51]">{detail}</p> : null}
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
        ? "border-[#b9dc9c] bg-[#eef6df] text-[#31521d]"
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
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-semibold text-white"
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
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e2e6df] pt-5 sm:flex-row sm:items-center sm:justify-between">
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
