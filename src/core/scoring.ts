// Farmer credit scorecard: points per factor, total 0–100, band A–E.
// Pure functions (no database access) so the seed script and the app share them.

export type ScoreInputs = {
  yieldRatio: number | null; // farmer yield / department average for the same crop and campaign (last 3 completed campaigns)
  cyclesTotal: number; // completed cycles in history
  cyclesFailed: number;
  creditTotalXof: number; // input credit received in completed campaigns
  creditRepaidXof: number;
  defaults: number; // defaulted input credits
  salesShare: number | null; // share of the last completed campaign's production sold to registered buyers
  cultivatedHa: number; // current campaign
  coopMember: boolean;
  yearsRegistered: number;
};

export type ScoreFactor = { key: string; label: string; points: number; max: number; detail: string };
export type Band = "A" | "B" | "C" | "D" | "E";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function computeScore(i: ScoreInputs): { score: number; band: Band; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  // Yield compared with peers (25)
  if (i.yieldRatio === null) {
    factors.push({ key: "yield", label: "Rendement comparé", points: 10, max: 25, detail: "Pas encore d'historique de récolte" });
  } else {
    factors.push({
      key: "yield",
      label: "Rendement comparé",
      points: Math.round(25 * clamp01((i.yieldRatio - 0.6) / 0.8)),
      max: 25,
      detail: `${pct(i.yieldRatio)} de la moyenne départementale`,
    });
  }

  // Stability: share of cycles that did not fail (15)
  if (i.cyclesTotal === 0) {
    factors.push({ key: "stability", label: "Régularité de production", points: 7, max: 15, detail: "Pas encore d'historique" });
  } else {
    const ok = 1 - i.cyclesFailed / i.cyclesTotal;
    factors.push({
      key: "stability",
      label: "Régularité de production",
      points: Math.round(15 * clamp01((ok - 0.6) / 0.4)),
      max: 15,
      detail: `${i.cyclesFailed} échec(s) sur ${i.cyclesTotal} cycles`,
    });
  }

  // Input credit repayment (25)
  if (i.creditTotalXof === 0) {
    factors.push({ key: "repayment", label: "Remboursement des crédits intrants", points: 12, max: 25, detail: "Aucun crédit intrant passé" });
  } else {
    const ratio = i.creditRepaidXof / i.creditTotalXof;
    factors.push({
      key: "repayment",
      label: "Remboursement des crédits intrants",
      points: Math.round(Math.max(0, 25 * clamp01((ratio - 0.4) / 0.6) - 5 * i.defaults)),
      max: 25,
      detail: `${pct(ratio)} remboursé, ${i.defaults} défaut(s)`,
    });
  }

  // Verified sales (15)
  if (i.salesShare === null) {
    factors.push({ key: "sales", label: "Ventes tracées", points: 5, max: 15, detail: "Pas de récolte la campagne dernière" });
  } else {
    factors.push({
      key: "sales",
      label: "Ventes tracées",
      points: Math.round(15 * clamp01(i.salesShare / 0.6)),
      max: 15,
      detail: `${pct(i.salesShare)} de la production vendue à des acheteurs enregistrés`,
    });
  }

  // Farm size (10)
  factors.push({
    key: "size",
    label: "Surface cultivée",
    points: Math.round(10 * clamp01(i.cultivatedHa / 5)),
    max: 10,
    detail: `${i.cultivatedHa.toFixed(1)} ha cette campagne`,
  });

  // Cooperative membership and seniority (10)
  factors.push({
    key: "network",
    label: "Coopérative et ancienneté",
    points: (i.coopMember ? 5 : 0) + Math.round(5 * clamp01(i.yearsRegistered / 5)),
    max: 10,
    detail: `${i.coopMember ? "Membre" : "Non membre"} d'une coopérative, inscrit depuis ${i.yearsRegistered} an(s)`,
  });

  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  return { score, band: scoreBand(score), factors };
}

export function scoreBand(score: number): Band {
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "E";
}

export type LendingPolicy = {
  incomeShare: number;
  bandMultipliers: Record<Band, number>;
  minScore: number;
  maxAmountXof: number;
};

// Indicative lending ceiling: the bank's policy applied to the platform's evidence. Rounded to 5,000 XOF.
export function lendingCeiling(policy: LendingPolicy, score: number, band: Band, estimatedIncomeXof: number): number {
  if (score < policy.minScore) return 0;
  const raw = estimatedIncomeXof * policy.incomeShare * (policy.bandMultipliers[band] ?? 0);
  return Math.floor(Math.min(raw, policy.maxAmountXof) / 5000) * 5000;
}
