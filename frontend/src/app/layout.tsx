import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const figures = Azeret_Mono({
  variable: "--font-figures",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nebenkostat: Nebenkostenabrechnung als Kassenbon",
  description:
    "Nebenkostenabrechnung für Privatvermieter mit 2 bis 5 Wohneinheiten. Jede Umlage mit Rechenweg, Belegarchiv und PDF-Export. Kein Ersatz für Rechtsberatung.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${display.variable} ${figures.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
