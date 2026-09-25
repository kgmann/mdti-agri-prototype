import Link from "next/link";
import { listBanks } from "@/core/partner";
import { xof } from "@/lib/format";

export default async function BankPicker() {
  const banks = await listBanks();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold">Espace partenaire financier</h1>
      <p className="text-sm text-neutral-600">
        Choisissez la banque. Chacune applique sa propre politique de prêt aux mêmes données de la plateforme : pour un même producteur, les plafonds indicatifs diffèrent.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => (
          <Link key={b.id} href={`/bank/${b.id}`} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm hover:border-brand-600">
            <div className="font-semibold">{b.name}</div>
            <div className="mt-1 text-xs text-neutral-600">
              {Math.round(b.policy.incomeShare * 100)} % du revenu estimé · score min. {b.policy.minScore} · plafond {xof(b.policy.maxAmountXof)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
