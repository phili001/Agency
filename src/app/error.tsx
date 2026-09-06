"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <AlertTriangle size={24} />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-[#647067]">
          No pudimos cargar esta sección. Vuelve a intentarlo; si sigue fallando,
          avisa a soporte.
        </p>
        {/* El digest identifica el error en los logs sin exponer el detalle. */}
        {error.digest ? (
          <p className="mt-3 rounded-lg bg-[#eef2eb] px-3 py-2 font-mono text-xs text-[#4d5a51]">
            Referencia: {error.digest}
          </p>
        ) : null}
        <button
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#10231c] px-4 text-sm font-semibold text-white"
          onClick={reset}
          type="button"
        >
          <RotateCcw size={17} />
          Reintentar
        </button>
      </section>
    </main>
  );
}
