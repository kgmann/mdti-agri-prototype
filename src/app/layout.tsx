import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agri-Digit Bénin — Prototype",
  description: "Prototype de la plateforme numérique multi-filières d'assistance et de conseil agricole.",
};

// Every page reads live data: never prerender at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-brand-800 text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Agri-Digit Bénin <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-xs font-normal">prototype</span>
            </Link>
            <nav className="flex gap-4 text-sm text-white/85">
              <Link href="/farmer" className="hover:text-white">Producteur</Link>
              <Link href="/gov" className="hover:text-white">Gouvernement</Link>
              <Link href="/bank" className="hover:text-white">Banque</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/5 px-4 py-3 text-center text-xs text-neutral-500">
          Prototype — données synthétiques (limites administratives réelles : geoBoundaries). Aucune donnée réelle de personne.
        </footer>
      </body>
    </html>
  );
}
