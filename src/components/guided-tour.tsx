"use client";

import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { type TourKey, tours } from "@/lib/tours";

export const START_TOUR_EVENT = "levy:start-tour";

type Rect = { height: number; left: number; top: number; width: number };

const PADDING = 6;
const CARD_WIDTH = 340;

function storageKey(tourKey: string) {
  return `levy-tour-${tourKey}`;
}

function readSeenLocally(tourKey: string) {
  try {
    return Boolean(window.localStorage.getItem(storageKey(tourKey)));
  } catch {
    return false;
  }
}

function findTarget(target: string) {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);

  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  // Sin tamaño = oculto (pestaña colapsada, bandeja vacía): se salta el paso.
  return rect.width > 0 && rect.height > 0 ? element : null;
}

/**
 * Guia con foco sobre elementos reales de la pantalla. Se lanza sola la
 * primera vez (si ni el navegador ni la cuenta la tienen vista) y se puede
 * relanzar con el boton "Ver guía" (evento START_TOUR_EVENT).
 */
export function GuidedTour({
  autoStart,
  seenTours,
  tourKey,
}: {
  autoStart: boolean;
  seenTours: Record<string, string>;
  tourKey: TourKey;
}) {
  const tour = tours[tourKey];
  const [active, setActive] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(tour.steps);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const [cardHeight, setCardHeight] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = visibleSteps[index];

  const start = useCallback(() => {
    const available = tour.steps.filter((item) => findTarget(item.target));

    if (available.length === 0) {
      return;
    }

    setVisibleSteps(available);
    setIndex(0);
    setActive(true);
  }, [tour.steps]);

  const finish = useCallback(async () => {
    setActive(false);
    setRect(null);

    try {
      window.localStorage.setItem(storageKey(tourKey), new Date().toISOString());
    } catch {
      // Sin localStorage (modo privado): la cuenta lo recuerda igual.
    }

    // Se guarda en la cuenta para que no vuelva a salir en otro dispositivo.
    if (!seenTours[tourKey]) {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { levy_tours: { ...seenTours, [tourKey]: new Date().toISOString() } },
      });
    }
  }, [seenTours, tourKey]);

  // Arranque automatico la primera vez, con un respiro para que pinte la pagina.
  useEffect(() => {
    if (!autoStart || seenTours[tourKey] || readSeenLocally(tourKey)) {
      return;
    }

    const timer = window.setTimeout(start, 700);
    return () => window.clearTimeout(timer);
  }, [autoStart, seenTours, start, tourKey]);

  // Relanzar desde el boton "Ver guía".
  useEffect(() => {
    function onStart(event: Event) {
      const detail = (event as CustomEvent<{ tourKey?: string }>).detail;

      if (!detail?.tourKey || detail.tourKey === tourKey) {
        start();
      }
    }

    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [start, tourKey]);

  // Medir el elemento del paso actual y seguirlo si la pagina se mueve.
  useEffect(() => {
    if (!active || !step) {
      return;
    }

    const element = findTarget(step.target);

    if (!element) {
      // El elemento desaparecio desde que arranco la guia: se salta el paso.
      const skip = window.setTimeout(() => {
        setIndex((current) => (current + 1 < visibleSteps.length ? current + 1 : current));
      }, 0);
      return () => window.clearTimeout(skip);
    }

    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    function measure() {
      const bounds = element!.getBoundingClientRect();
      setRect({
        height: bounds.height + PADDING * 2,
        left: bounds.left - PADDING,
        top: bounds.top - PADDING,
        width: bounds.width + PADDING * 2,
      });
      setViewport({ height: window.innerHeight, width: window.innerWidth });
      setCardHeight(cardRef.current?.offsetHeight ?? 220);
    }

    const first = window.setTimeout(measure, 0);
    const settle = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, visibleSteps.length]);

  // Teclado: Esc cierra, flechas navegan.
  useEffect(() => {
    if (!active) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void finish();
      } else if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, visibleSteps.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, visibleSteps.length]);

  const cardStyle = useMemo(() => {
    if (!rect || viewport.width === 0) {
      return undefined;
    }

    // En pantallas estrechas la tarjeta va abajo, fija, para no tapar el foco.
    if (viewport.width < 640) {
      return { bottom: 12, left: 12, right: 12 } as const;
    }

    const spaceBelow = viewport.height - (rect.top + rect.height);
    const top =
      spaceBelow > cardHeight + 16
        ? rect.top + rect.height + 12
        : Math.max(12, rect.top - cardHeight - 12);
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, viewport.width - CARD_WIDTH - 12),
    );

    return { left, top, width: CARD_WIDTH } as const;
  }, [cardHeight, rect, viewport]);

  if (!active || !step) {
    return null;
  }

  const isLast = index === visibleSteps.length - 1;

  return (
    <div aria-live="polite" className="fixed inset-0 z-50" role="dialog" aria-label={tour.title}>
      {/* Bloquea clics fuera del paso mientras dura la guia. */}
      <div className="absolute inset-0" />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-[#d2f36b] transition-all duration-300"
          style={{
            boxShadow: "0 0 0 9999px rgba(16, 35, 28, 0.6)",
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }}
        />
      ) : null}
      <div
        className="absolute grid gap-3 rounded-2xl border border-[#d9ded3] bg-white p-4 text-[#20231f] shadow-2xl"
        ref={cardRef}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#647067]">
            <CircleHelp size={14} />
            {tour.title} · {index + 1} de {visibleSteps.length}
          </div>
          <button
            aria-label="Cerrar guía"
            className="rounded-lg p-1 text-[#647067] hover:bg-[#f3f4ef]"
            onClick={() => void finish()}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div>
          <p className="text-base font-semibold">{step.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#4d5a51]">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-medium text-[#647067] underline-offset-4 hover:underline"
            onClick={() => void finish()}
            type="button"
          >
            Saltar
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium"
                onClick={() => setIndex(index - 1)}
                type="button"
              >
                <ArrowLeft size={15} />
                Anterior
              </button>
            ) : null}
            <button
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#10231c] px-3 text-sm font-semibold text-white"
              onClick={() => (isLast ? void finish() : setIndex(index + 1))}
              type="button"
            >
              {isLast ? "Entendido" : "Siguiente"}
              {!isLast ? <ArrowRight size={15} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Boton del encabezado que relanza la guia de la seccion actual. */
export function TourLauncher({ tourKey }: { tourKey: TourKey }) {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(START_TOUR_EVENT, { detail: { tourKey } }))
      }
      type="button"
    >
      <CircleHelp size={16} />
      Ver guía
    </button>
  );
}
