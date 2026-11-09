import Image from "next/image";
import Link from "next/link";

import { legalLinks } from "@/lib/legal";

// Piezas del sistema de diseño de Levy que comparten las páginas públicas.
// Los tokens (colores, radios, fuentes) viven en src/app/globals.css.
export const brandCard = "rounded-xl border border-line bg-paper p-6 sm:p-8";
export const brandNote = "rounded-xl bg-yellow-soft p-5";
export const brandEyebrow = "text-xs font-bold tracking-[0.6px] text-muted uppercase";
export const brandInput =
  "h-11 rounded-lg border-[1.5px] border-line bg-paper px-3 font-normal text-ink outline-none transition placeholder:text-faint focus:border-ink";
export const brandButton =
  "inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-yellow px-5 text-base font-extrabold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)] transition hover:bg-yellow-strong active:scale-[0.98] disabled:cursor-progress disabled:opacity-50";
export const brandLink = "font-semibold text-ink underline underline-offset-4";
export const brandError = "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

export function BrandMark({ tag }: { tag?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image alt="" height={36} priority src="/levy-logo.png" width={34} />
      <span className="font-display text-xl font-extrabold tracking-[-0.4px]">Levy</span>
      {tag ? (
        <span className="-rotate-3 rounded-sm bg-ink px-2.5 py-0.5 font-display text-base font-extrabold tracking-[-0.4px] text-yellow">{tag}</span>
      ) : null}
    </span>
  );
}

export function PublicShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-2 text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center px-5 sm:px-7">
          <Link href="/">
            <BrandMark />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-5 py-12">{children}</main>
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-muted sm:px-7">
          <p>© 2026 Levy</p>
          <nav aria-label="Textos legales" className="flex flex-wrap gap-x-5 gap-y-1">
            {legalLinks.map((link) => (
              <Link className="hover:text-ink" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
