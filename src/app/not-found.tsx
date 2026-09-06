import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f3] p-5 text-[#20231f]">
      <section className="w-full max-w-md rounded-lg border border-[#d9ded3] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-[#eef2eb] text-[#35735b]">
          <Compass size={24} />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Esta página no existe</h1>
        <p className="mt-2 text-sm text-[#647067]">
          El enlace es incorrecto o el contenido se movió de sitio.
        </p>
        <Link
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#10231c] px-4 text-sm font-semibold text-white"
          href="/"
        >
          Volver al inbox
        </Link>
      </section>
    </main>
  );
}
