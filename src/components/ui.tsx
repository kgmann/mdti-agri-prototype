// Small shared UI pieces.
export function Card({ title, children, className = "" }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 font-semibold text-neutral-800">{title}</h2>}
      {children}
    </section>
  );
}

export function Table({ head, rows, empty = "Aucune donnée" }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/10 text-xs text-neutral-500">
          <tr>{head.map((h, i) => <th key={i} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/5 last:border-0">
              {r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, color = "#52514e" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: color, color }}>
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
