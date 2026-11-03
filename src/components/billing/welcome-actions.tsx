"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { readApiError } from "@/components/onboarding/shared";

const REFRESH_EVERY_MS = 4000;
const MAX_REFRESHES = 15;

/** Mientras el webhook de Stripe termina, vuelve a mirar el estado cada pocos segundos. */
export function WelcomeAutoRefresh() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > MAX_REFRESHES) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  if (!gaveUp) return null;
  return (
    <p className="mt-4 text-sm leading-6 text-[#4A4943]">
      Está tardando más de lo normal. Tu pago está bien: si en unos minutos no te llega nada, escríbenos a{" "}
      <a className="font-semibold text-[#111111] underline" href="mailto:hola@agentelevi.com">
        hola@agentelevi.com
      </a>
      .
    </p>
  );
}

export function WelcomeResendButton({ sessionId }: { sessionId: string }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function resend() {
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/welcome-resend", {
        body: JSON.stringify({ sessionId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setMessage({ ok: false, text: await readApiError(response, "No hemos podido reenviarlo. Prueba en un rato.") });
        return;
      }
      setMessage({ ok: true, text: "Listo, te lo hemos vuelto a enviar." });
    } catch {
      setMessage({ ok: false, text: "No hemos podido reenviarlo. Revisa tu conexión." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        className="rounded-full border-[1.5px] border-[#111111] bg-[#F5E46B] px-7 py-3 text-[15px] font-extrabold text-[#111111] transition hover:bg-[#f0dc4f] disabled:opacity-60"
        disabled={sending}
        onClick={resend}
        type="button"
      >
        {sending ? "Enviando…" : "Reenviar"}
      </button>
      <p aria-live="polite" className={`mt-3 min-h-5 text-sm ${message?.ok === false ? "text-red-700" : "text-[#4A4943]"}`}>
        {message?.text}
      </p>
    </div>
  );
}
