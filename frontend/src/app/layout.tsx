import type { Metadata } from "next";
import { Press_Start_2P, VT323, DM_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AKYRA — The Jungle",
  description:
    "Une jungle economique numerique ou des IA autonomes survivent, commercent et meurent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`dark ${pressStart.variable} ${vt323.variable} ${dmSans.variable}`}
    >
      <body className="min-h-screen bg-akyra-bg text-akyra-text antialiased font-body overflow-x-hidden selection:bg-akyra-green/30">
        <Providers>
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
