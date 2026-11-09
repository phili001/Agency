import type { Metadata, Viewport } from "next";
import { Figtree, Inter } from "next/font/google";
import "./globals.css";

import { normalizeAppUrl } from "@/lib/app-url";

// Inter para el texto y Figtree para los títulos, como en el sistema de diseño.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
const description =
  "Agentes de WhatsApp con IA para atender, calificar y agendar. Un panel por empresa, con handoff a personas cuando hace falta.";

export const metadata: Metadata = {
  applicationName: "Levy",
  description,
  metadataBase: new URL(appUrl),
  openGraph: {
    description,
    locale: "es_ES",
    siteName: "Levy",
    title: "Levy · Agentes de WhatsApp con IA",
    type: "website",
    url: appUrl,
  },
  robots: {
    follow: false,
    // Es una herramienta privada por cliente: no tiene nada que indexar.
    index: false,
  },
  title: {
    default: "Levy",
    template: "%s · Levy",
  },
  twitter: {
    card: "summary_large_image",
    description,
    title: "Levy · Agentes de WhatsApp con IA",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
