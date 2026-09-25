"use client";
// Supply map: lines from suppliers to an actor and from the actor to its buyers, or a traced batch back to its farmers.
import ParcelMap, { type MapLine, type MapPoint } from "./ParcelMap";
import type { ActorNetwork, ActorType, BatchTrace } from "@/core/actors";

const TYPE_COLORS: Record<string, string> = {
  farmer: "#1baf7a",
  cooperative: "#eda100",
  processor: "#eb6834",
  distributor: "#2a78d6",
  bank: "#4a3aa7",
  insurer: "#4a3aa7",
};
const TYPE_LABELS: Record<string, string> = { farmer: "Producteur", cooperative: "Coopérative", processor: "Transformateur", distributor: "Distributeur" };
const IN = "#1f7a3d";
const OUT = "#2a78d6";
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const t = (kg: number) => `${nf.format(kg / 1000)} t`;
const EMPTY = { type: "FeatureCollection" as const, features: [] };

function node(lat: number, lon: number, type: ActorType | "center", label: React.ReactNode, radius = 5): MapPoint {
  return { lat, lon, radius, color: type === "center" ? "#134d28" : TYPE_COLORS[type], label };
}

function Legend({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
      {items.map(([label, color, line]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={line ? "inline-block h-0.5 w-5" : "inline-block h-2.5 w-2.5 rounded-full"} style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function NetworkMap({ network, name }: { network: ActorNetwork; name: string }) {
  const max = Math.max(1, ...network.suppliers.map((s) => s.quantityKg), ...network.buyers.map((b) => b.quantityKg));
  const width = (kg: number) => 1 + 5 * Math.sqrt(kg / max);
  const c: [number, number] = [network.center.lat, network.center.lon];
  const lines: MapLine[] = [
    ...network.suppliers.map((s) => ({ positions: [[s.lat, s.lon], c] as [number, number][], color: IN, weight: width(s.quantityKg), label: `${s.name} → ${t(s.quantityKg)} (${s.products.join(", ")})` })),
    ...network.buyers.map((b) => ({ positions: [c, [b.lat, b.lon]] as [number, number][], color: OUT, weight: width(b.quantityKg), dashed: true, label: `→ ${b.name} : ${t(b.quantityKg)} (${b.products.join(", ")})` })),
  ];
  const points: MapPoint[] = [
    ...[...network.suppliers, ...network.buyers].map((n) =>
      node(n.lat, n.lon, n.type, <a className="text-brand-700 underline" href={`/gov/actors/${n.id}`}>{n.name}</a>),
    ),
    node(c[0], c[1], "center", <b>{name}</b>, 9),
  ];
  const types = [...new Set([...network.suppliers, ...network.buyers].map((n) => n.type))];
  return (
    <div>
      <div className="h-96 overflow-hidden rounded-lg">
        <ParcelMap parcels={EMPTY} lines={lines} points={points} fitToParcels colorOf={() => ""} popup={() => null} />
      </div>
      <Legend items={[["Approvisionnement (vers l'acteur)", IN, true], ["Ventes (depuis l'acteur)", OUT, true], ...types.map((ty) => [TYPE_LABELS[ty] ?? ty, TYPE_COLORS[ty]] as [string, string])]} />
      <p className="mt-1 text-xs text-neutral-500">L&apos;épaisseur des lignes est proportionnelle aux quantités échangées. Survolez une ligne pour le détail.</p>
    </div>
  );
}

export function TraceMap({ trace }: { trace: BatchTrace }) {
  const p: [number, number] = [trace.processorLocation.lat, trace.processorLocation.lon];
  const lines: MapLine[] = [];
  const points: MapPoint[] = [node(p[0], p[1], "center", <b>{trace.batch.processorName}</b>, 9)];
  for (const s of trace.suppliers) {
    lines.push({ positions: [[s.lat, s.lon], p], color: IN, weight: 3, label: `${s.name} → ${t(s.quantityKg)}` });
    points.push(node(s.lat, s.lon, s.type, s.name, 6));
  }
  for (const co of trace.viaCooperatives) {
    for (const f of co.farmers) {
      lines.push({ positions: [[f.lat, f.lon], [co.lat, co.lon]], color: TYPE_COLORS.cooperative, weight: 1.5, dashed: true, label: `${f.name} → ${co.cooperativeName} : ${t(f.quantityKg)}` });
      points.push(node(f.lat, f.lon, "farmer", f.name, 4));
    }
  }
  return (
    <div>
      <div className="h-80 overflow-hidden rounded-lg">
        <ParcelMap parcels={EMPTY} lines={lines} points={points} fitToParcels colorOf={() => ""} popup={() => null} />
      </div>
      <Legend items={[["Livraison au transformateur", IN, true], ["Livraison à la coopérative", TYPE_COLORS.cooperative, true], ["Producteur", TYPE_COLORS.farmer], ["Coopérative", TYPE_COLORS.cooperative]]} />
    </div>
  );
}
