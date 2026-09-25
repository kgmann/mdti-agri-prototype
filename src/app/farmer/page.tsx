import Link from "next/link";
import { demoFarmers, searchFarmers, type FarmerSummary } from "@/core/farmers";
import { Badge } from "@/components/ui";
import { BAND_COLORS } from "@/lib/format";

function FarmerCard({ f, why }: { f: FarmerSummary; why?: string }) {
  return (
    <Link href={`/farmer/${f.id}`} className="block rounded-xl border border-black/10 bg-white p-4 shadow-sm hover:border-brand-600">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{f.name}</span>
        {f.band && <Badge color={BAND_COLORS[f.band]}>Score {f.score}</Badge>}
      </div>
      <div className="text-sm text-neutral-600">{f.commune}, {f.department} · {f.mainCrop ?? "—"} · {f.language === "fon" ? "parle fon" : "français"}</div>
      {why && <div className="mt-1 text-xs text-brand-700">{why}</div>}
      {f.unreadAlerts > 0 && <div className="mt-1 text-xs text-red-700">{f.unreadAlerts} alerte(s) non lue(s)</div>}
    </Link>
  );
}

export default async function FarmerPicker({ searchParams }: PageProps<"/farmer">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [demo, results] = await Promise.all([demoFarmers(), q ? searchFarmers(q) : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">Espace producteur</h1>
        <p className="text-sm text-neutral-600">
          Choisissez le producteur dont vous voulez voir l&apos;espace. Dans une version réelle, chacun se connecterait avec son NPI ; ici, une simple sélection suffit.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{demo.map((f) => <FarmerCard key={f.id} f={f} why={f.why} />)}</div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Chercher un producteur (nom, NPI, commune)" className="flex-1 rounded border border-black/15 bg-white px-3 py-2 text-sm" />
        <button className="rounded bg-brand-700 px-4 py-2 text-sm text-white">Chercher</button>
      </form>
      {q && (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.length ? results.map((f) => <FarmerCard key={f.id} f={f} />) : <p className="text-sm text-neutral-500">Aucun producteur trouvé.</p>}
        </div>
      )}
    </div>
  );
}
