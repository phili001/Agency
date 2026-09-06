import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { normalizeAppUrl } from "@/lib/app-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  themeColor: "#10231c",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
