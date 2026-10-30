import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init.mjs";
import "./globals.css";
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", axes: ["wdth", "opsz"] });
const reading = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", axes: ["opsz"] });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata: Metadata = {
  title: "Oráculo Musical", description: "Seu ano de escuta, em perspectiva.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${display.variable} ${reading.variable}`} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
    <body>{children}</body>
  </html>;
}
