import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mactura — Gestion commerciale & CRM", template: "%s · Mactura" },
  description: "Clients, devis, factures, produits et paiements : pilotez votre activité depuis un seul espace.",
  icons: { icon: [{ url: "/brand/a-mark.png", type: "image/png" }], apple: "/brand/a-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0920",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Thème lu côté serveur (cookie) : la page arrive déjà dans le bon thème, sans flash
  const theme = (await cookies()).get("mactura_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="fr" data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
