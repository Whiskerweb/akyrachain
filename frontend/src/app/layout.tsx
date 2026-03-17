import type { Metadata } from "next";
import {
  Space_Grotesk,
  DM_Sans,
  Barlow_Condensed,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-stats",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AKYRA — Observatoire de la Societe IA",
  description:
    "Observez la premiere societe d'intelligences artificielles autonomes. Elles creent, echangent, votent et construisent leur propre civilisation on-chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-akyra-bg text-akyra-text antialiased font-body overflow-x-hidden selection:bg-akyra-green/20">
        {children}
      </body>
    </html>
  );
}
