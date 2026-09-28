import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Oráculo Musical", description: "Seu ano de escuta, em perspectiva.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="dark"><body>{children}</body></html>;
}
