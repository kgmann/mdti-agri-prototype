import Link from "next/link";
import { ACTOR_TYPES, ACTOR_TYPE_LABELS, searchActors, type ActorType } from "@/core/actors";
import { getCampaigns, getCurrentCampaign, getDepartments, getProducts } from "@/core/reference";
import { Card, Table } from "@/components/ui";
import { fmt } from "@/lib/format";

export default async function ActorsPage({ searchParams }: PageProps<"/gov/actors">) {
  const sp = await searchParams;
  const q = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const current = await getCurrentCampaign();
  const filter = {
    type: q("type") as ActorType | undefined,
    department: q("department") ? Number(q("department")) : undefined,
    search: q("search"),
    crop: q("crop"),
    input: q("input"),
    processed: q("processed"),
    campaign: q("campaign") ? Number(q("campaign")) : undefined,
    page: q("page") ? Number(q("page")) : 1,
  };
  const [result, departments, crops, inputs, processed, campaigns] = await Promise.all([
    searchActors(filter, current.id),
    getDepartments(),
    getProducts("crop"),
    getProducts("input"),
    getProducts("processed"),
    getCampaigns(),
  ]);
  const pages = Math.ceil(result.total / result.pageSize);
  const pageLink = (p: number) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>), page: String(p) })}`;
  const field = "rounded border border-black/15 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <Card title="Registre des acteurs">
        <form className="flex flex-wrap items-end gap-2 text-xs text-neutral-600">
          <label>Recherche<br /><input name="search" defaultValue={filter.search} placeholder="Nom, NPI ou IFU" className={field} /></label>
          <label>Type<br />
            <select name="type" defaultValue={filter.type ?? ""} className={field}>
              <option value="">Tous</option>
              {ACTOR_TYPES.map((t) => <option key={t} value={t}>{ACTOR_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label>Département<br />
            <select name="department" defaultValue={filter.department ?? ""} className={field}>
              <option value="">Tous</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>Culture (produite ou achetée)<br />
            <select name="crop" defaultValue={filter.crop ?? ""} className={field}>
              <option value="">Toutes</option>
              {crops.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}
            </select>
          </label>
          <label>Intrant reçu<br />
            <select name="input" defaultValue={filter.input ?? ""} className={field}>
              <option value="">Indifférent</option>
              {inputs.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}
            </select>
          </label>
          <label>Campagne<br />
            <select name="campaign" defaultValue={filter.campaign ?? current.id} className={field}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </label>
          <label>Produit transformé<br />
            <select name="processed" defaultValue={filter.processed ?? ""} className={field}>
              <option value="">Indifférent</option>
              {processed.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}
            </select>
          </label>
          <button className="rounded bg-brand-700 px-4 py-1.5 text-sm text-white">Filtrer</button>
          <Link href="/gov/actors" className="px-2 py-1.5 text-sm text-brand-700 underline">Réinitialiser</Link>
        </form>
        <p className="mt-3 text-xs text-neutral-500">
          La culture et l&apos;intrant portent sur la campagne choisie. Pour des questions plus complexes, utilisez l&apos;<Link className="underline" href="/gov/assistant">assistant données</Link>.
        </p>
      </Card>
      <Card title={`${fmt(result.total)} acteurs`}>
        <Table
          head={["Nom", "Type", "NPI / IFU", "Commune", "Département", "Détail"]}
          rows={result.rows.map((a) => [
            <Link key="n" href={`/gov/actors/${a.id}`} className="text-brand-700 hover:underline">{a.name}</Link>,
            ACTOR_TYPE_LABELS[a.type],
            <span key="i" className="font-mono text-xs">{a.nationalId}</span>,
            a.commune,
            a.department,
            a.detail ?? "",
          ])}
        />
        {pages > 1 && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            {filter.page! > 1 && <Link href={pageLink(filter.page! - 1)} className="text-brand-700">← Précédent</Link>}
            <span className="text-neutral-500">Page {filter.page} / {pages}</span>
            {filter.page! < pages && <Link href={pageLink(filter.page! + 1)} className="text-brand-700">Suivant →</Link>}
          </div>
        )}
      </Card>
    </div>
  );
}
