import Link from "next/link";
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
    { href: base, label: "Ma ferme" },
    { href: `${base}/alerts`, label: "Alertes", badge: unread.length },
    { href: `${base}/assistant`, label: "Assistant" },
    { href: `${base}/credit`, label: "Crédit" },
  ];
  return (
    <div className="mx-auto max-w-3xl pb-6">
      <div className="bg-white px-4 pt-4 shadow-sm">
        <Link href="/farmer" className="text-xs text-brand-700">← Changer de producteur</Link>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{farmer.name}</h1>
          <span className="text-xs text-neutral-500">NPI {farmer.npi}</span>
        </div>
        <p className="text-sm text-neutral-600">{farmer.commune}, {farmer.department}{farmer.cooperative ? ` · ${farmer.cooperative.name}` : ""}</p>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="relative whitespace-nowrap rounded-t px-3 py-2 text-sm text-neutral-700 hover:bg-brand-50">
              {t.label}
              {t.badge ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{t.badge}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
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
