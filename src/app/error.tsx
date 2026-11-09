"use client";

import { useEffect } from "react";

import { brandButton, brandCard, PublicShell } from "@/components/brand/public-shell";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PublicShell>
      <section className={`${brandCard} my-auto w-full max-w-md text-center`}>
        <h1 className="text-3xl font-extrabold tracking-tight">Algo salió mal</h1>
        <p className="mt-3 leading-7 text-muted">No pudimos cargar esta sección. Vuelve a intentarlo; si sigue fallando, avisa a soporte.</p>
        {/* El digest identifica el error en los logs sin exponer el detalle. */}
        {error.digest ? <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 font-mono text-xs text-ink-2">Referencia: {error.digest}</p> : null}
        <button className={`${brandButton} mt-6`} onClick={reset} type="button">
          Reintentar
        </button>
      </section>
    </PublicShell>
  );
}
