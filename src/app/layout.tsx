import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agri-Digit Bénin — Prototype",
  description: "Prototype de la plateforme numérique multi-filières d'assistance et de conseil agricole.",
};

// Every page reads live data: never prerender at build time.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/farmer", label: "Producteur" },
  { href: "/gov", label: "Gouvernement" },
  { href: "/bank", label: "Banque" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-[1100] bg-brand-800 text-white shadow">
          <div className="mx-auto flex h-13 max-w-7xl items-center gap-4 px-4 sm:gap-8">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Logo />
              <span className="hidden sm:inline">Agri-Digit Bénin</span>
              <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide">prototype</span>
            </Link>
            <nav className="flex h-full gap-1 text-sm">
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href} className="flex h-full items-center border-b-2 border-transparent px-2 text-white/75 hover:text-white sm:px-3" activeClassName="!border-amber-300 !text-white font-medium">
                  {n.label}
                </NavLink>
              ))}
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
