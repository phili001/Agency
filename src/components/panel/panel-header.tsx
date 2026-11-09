import { AlertCircle, LogOut } from "lucide-react";

import { signOut } from "@/app/actions";
import { GuidedTour, TourLauncher } from "@/components/guided-tour";
import { type TourKey, getSeenTours } from "@/lib/tours";
import { type AppSection, sectionTitles } from "@/lib/panel-data";

// Secciones que aprovechan todo el ancho (calendario semanal, editor de flujos).
const wideSections = new Set<AppSection>(["agenda", "flows"]);

/**
 * Cabecera y rejilla de una seccion del panel. El sidebar vive en el layout y
 * no se vuelve a pedir al navegar; esto es lo que cambia de una seccion a otra.
 */
export function PanelPage({
  aside,
  children,
  hasWorkspace,
  section,
  tourKey,
  userMetadata,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  hasWorkspace: boolean;
  section: AppSection;
  tourKey?: TourKey | null;
  userMetadata?: Record<string, unknown>;
}) {
  const header = sectionTitles[section];

  return (
    <>
      <header className="border-b border-line bg-paper px-5 py-4 sm:px-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.6px] uppercase text-muted">
              {header.eyebrow}
            </p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.6px]">
              {header.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {tourKey ? <TourLauncher tourKey={tourKey} /> : null}
            <form action={signOut}>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-2 transition hover:bg-paper-2">
                <LogOut size={16} />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <div
        className={`grid min-w-0 gap-5 p-5 sm:px-7 ${
          section === "dashboard"
            ? // La bandeja necesita el ancho: las métricas solo van al lado en pantallas grandes.
              "min-[1680px]:grid-cols-[minmax(0,1fr)_280px]"
            : wideSections.has(section)
              ? ""
              : // Formularios y listas: en monitores anchos no se estiran de lado a lado.
                "mx-auto w-full max-w-[1240px]"
        }`}
      >
        <div className="grid min-w-0 content-start gap-5">
          {hasWorkspace ? null : (
            <section className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-semibold">Falta crear una empresa.</p>
                <p className="mt-1">
                  Entra al onboarding para crear tu empresa y conectar el primer
                  número de WhatsApp.
                </p>
              </div>
            </section>
          )}
          {children}
        </div>
        {aside}
      </div>

      {tourKey ? (
        <GuidedTour autoStart seenTours={getSeenTours(userMetadata)} tourKey={tourKey} />
      ) : null}
    </>
  );
}
