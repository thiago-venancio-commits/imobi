import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "TSV Imóveis — Conectando pessoas aos melhores imóveis",
    template: "%s · TSV Imóveis",
  },
  description:
    "Encontre casas, apartamentos, terrenos e imóveis comerciais com atendimento e intermediação completa da TSV Imóveis.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "TSV Imóveis",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
