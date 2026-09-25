import Link from "next/link";
import NavLink from "@/components/NavLink";
import { notFound } from "next/navigation";
import { farmerAlerts } from "@/core/alerts";
import { getFarmer } from "@/core/farmers";

export default async function FarmerLayout({ children, params }: LayoutProps<"/farmer/[id]">) {
  const { id } = await params;
  const farmer = await getFarmer(Number(id));
  if (!farmer) notFound();
  const unread = (await farmerAlerts(farmer.id)).filter((a) => !a.readAt);
  const base = `/farmer/${farmer.id}`;
  const tabs = [
    { href: base, label: "Ma ferme", exact: true },
    { href: `${base}/alerts`, label: "Alertes", badge: unread.length },
    { href: `${base}/assistant`, label: "Assistant" },
    { href: `${base}/credit`, label: "Crédit" },
  ];
  return (
    <div className="mx-auto max-w-3xl pb-6">
      <div className="bg-white px-4 pt-4">
        <Link href="/farmer" className="text-xs text-brand-700">← Changer de producteur</Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
            {farmer.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="truncate text-xl font-semibold">{farmer.name}</h1>
              <span className="shrink-0 text-xs text-neutral-500">NPI {farmer.npi}</span>
            </div>
            <p className="truncate text-sm text-neutral-600">{farmer.commune}, {farmer.department}{farmer.cooperative ? ` · ${farmer.cooperative.name}` : ""}</p>
          </div>
        </div>
      </div>
      <nav className="sticky top-13 z-[1050] flex gap-1 overflow-x-auto border-b border-black/10 bg-white/95 px-4 shadow-sm backdrop-blur">
        {tabs.map((t) => (
          <NavLink key={t.href} href={t.href} exact={t.exact} className="relative whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-neutral-600 hover:text-brand-800" activeClassName="!border-brand-600 !text-brand-800 font-medium">
            {t.label}
            {t.badge ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{t.badge}</span> : null}
          </NavLink>
        ))}
      </nav>
      {unread.length > 0 && (
        <Link href={`${base}/alerts`} className="mx-4 mt-4 block rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm">
          <span className="font-semibold text-red-800">⚠ {unread[0].title}</span>
          <span className="block text-red-900/80">{unread.length > 1 ? `et ${unread.length - 1} autre(s) alerte(s) — ` : ""}Touchez pour lire.</span>
        </Link>
      )}
      <div className="space-y-4 px-4 pt-4">{children}</div>
    </div>
  );
}
