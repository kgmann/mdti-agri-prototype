"use client";
// Yield per campaign (one series) with the current campaign's prediction and its uncertainty band.
import { CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";

type Point = { campaign: string; yield: number | null; predicted?: number; err?: [number, number] };
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default function YieldChart({ data }: { data: Point[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
          <CartesianGrid stroke="#e7e6e1" vertical={false} />
          <XAxis dataKey="campaign" tick={{ fontSize: 12, fill: "#52514e" }} tickLine={false} axisLine={{ stroke: "#d4d3cd" }} />
          <YAxis tick={{ fontSize: 12, fill: "#52514e" }} tickLine={false} axisLine={false} tickFormatter={(v) => nf.format(v)} unit=" kg/ha" width={80} />
          <Tooltip
            formatter={(v, name) => [`${nf.format(Number(v))} kg/ha`, name === "yield" ? "Rendement observé" : "Rendement prévu"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line dataKey="yield" stroke="#2a78d6" strokeWidth={2} dot={{ r: 4, fill: "#2a78d6", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
          <Scatter dataKey="predicted" fill="#eb6834" shape="diamond" isAnimationActive={false}>
            <ErrorBar dataKey="err" width={8} stroke="#eb6834" strokeWidth={2} direction="y" />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
