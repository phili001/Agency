import Link from "next/link";

import { brandEyebrow, PublicShell } from "@/components/brand/public-shell";
import { legalEntity, legalLinks } from "@/lib/legal";

/** Marco común de las páginas legales: título, índice de secciones y texto legible. */
export function LegalPage({
  children,
  current,
  intro,
  title,
}: {
  children: React.ReactNode;
  current: (typeof legalLinks)[number]["href"];
  intro: React.ReactNode;
  title: string;
}) {
  return (
    <PublicShell>
      <article className="w-full max-w-[760px]">
        <nav aria-label="Textos legales" className="flex flex-wrap gap-2">
          {legalLinks.map((link) => (
            <Link
              aria-current={link.href === current ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                link.href === current ? "bg-ink text-paper" : "text-muted hover:bg-paper hover:text-ink"
              }`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <header className="mt-8">
          <p className={brandEyebrow}>Última actualización: {legalEntity.updatedAt}</p>
          <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-[-0.8px] sm:text-[40px]">{title}</h1>
          <div className="mt-4 text-lg leading-8 text-ink-2">{intro}</div>
        </header>

        <div className="mt-10 rounded-xl border border-line bg-paper p-6 sm:p-9">{children}</div>
      </article>
    </PublicShell>
  );
}

export function LegalSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border-t border-line pt-7 first:border-t-0 first:pt-0 [&+section]:mt-7">
      <h2 className="text-xl font-extrabold tracking-[-0.3px]">{title}</h2>
      <div className="mt-3 grid gap-3 leading-7 text-ink-2 [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:grid [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

/** Quién es el titular. Solo muestra los datos rellenos en src/lib/legal.ts. */
export function LegalOwner() {
  const rows = [
    ["Titular", legalEntity.name],
    ["NIF", legalEntity.taxId],
    ["Domicilio", legalEntity.address],
    ["País", legalEntity.country],
    ["Correo", legalEntity.email],
    ["Web", legalEntity.website],
  ].filter(([, value]) => value);

  return (
    <dl className="grid gap-x-6 gap-y-1.5 rounded-lg bg-paper-2 p-4 text-sm sm:grid-cols-[120px_1fr]">
      {rows.map(([label, value]) => (
        <div className="contents" key={label}>
          <dt className="font-bold text-ink">{label}</dt>
          <dd className="[overflow-wrap:anywhere]">
            {label === "Correo" ? <a href={`mailto:${value}`}>{value}</a> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const legalMail = <a href={`mailto:${legalEntity.email}`}>{legalEntity.email}</a>;
