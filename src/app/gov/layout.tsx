import Link from "next/link";

const TABS = [
  { href: "/gov", label: "Carte" },
  { href: "/gov/actors", label: "Acteurs" },
  { href: "/gov/yields", label: "Rendements" },
  { href: "/gov/alerts", label: "Alertes envoyées" },
  { href: "/gov/assistant", label: "Assistant données" },
];

export default function GovLayout({ children }: LayoutProps<"/gov">) {
  return (
    <div>
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4">
          <span className="mr-3 py-3 text-sm font-semibold text-brand-800">Tableau de bord MAEP</span>
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="whitespace-nowrap rounded px-3 py-3 text-sm text-neutral-700 hover:bg-brand-50 hover:text-brand-800">
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
