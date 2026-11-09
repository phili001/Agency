import Link from "next/link";

import { brandButton, brandCard, PublicShell } from "@/components/brand/public-shell";

export default function NotFound() {
  return (
    <PublicShell>
      <section className={`${brandCard} my-auto w-full max-w-md text-center`}>
        <h1 className="text-3xl font-extrabold tracking-tight">Esta página no existe</h1>
        <p className="mt-3 leading-7 text-muted">El enlace es incorrecto o el contenido se movió de sitio.</p>
        <Link className={`${brandButton} mt-6`} href="/">
          Volver al inicio
        </Link>
      </section>
    </PublicShell>
  );
}
