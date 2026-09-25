import NavLink from "@/components/NavLink";

const TABS = [
  { href: "/gov", label: "Carte", exact: true },
  { href: "/gov/actors", label: "Acteurs" },
  { href: "/gov/yields", label: "Rendements" },
  { href: "/gov/alerts", label: "Alertes envoyées" },
  { href: "/gov/assistant", label: "Assistant données" },
];

export default function GovLayout({ children }: LayoutProps<"/gov">) {
  return (
    <div>
      <div className="sticky top-13 z-[1050] border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4">
          <span className="mr-3 hidden py-3 text-sm font-semibold text-brand-800 md:inline">Tableau de bord MAEP</span>
          {TABS.map((t) => (
            <NavLink key={t.href} href={t.href} exact={t.exact} className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-neutral-600 hover:text-brand-800" activeClassName="!border-brand-600 !text-brand-800 font-medium">
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
