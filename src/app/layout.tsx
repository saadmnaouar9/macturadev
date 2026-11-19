import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mactura — Gestion commerciale & CRM", template: "%s · Mactura" },
  description: "Clients, devis, factures, produits et paiements : pilotez votre activité depuis un seul espace.",
  icons: { icon: [{ url: "/brand/a-mark.png", type: "image/png" }], apple: "/brand/a-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#3a3182",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
