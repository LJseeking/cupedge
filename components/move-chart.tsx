"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { DEFAULT_LOCALE, getDictionary, type Locale } from "@/lib/i18n";
import type { TeamMove } from "@/lib/types/valuation";

export function MoveChart({
  moves,
  locale = DEFAULT_LOCALE
}: {
  moves: TeamMove[];
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const data = moves.slice(0, 10).map((move) => ({
    team: move.team,
    change: Number((move.change * 100).toFixed(2))
  }));

  return (
    <div className="h-72 rounded-lg border border-line bg-panel p-4">
      <div className="mb-4 font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {t.moves.chartTitle}
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#272b30" vertical={false} />
          <XAxis dataKey="team" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#8b949e"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#111315",
              border: "1px solid #272b30",
              borderRadius: 8,
              color: "#f4f4f5"
            }}
            formatter={(value) => [`${value}%`, t.moves.change]}
          />
          <Bar dataKey="change" radius={[4, 4, 0, 0]}>
            {data.map((item) => (
              <Cell key={item.team} fill={item.change >= 0 ? "#dc2626" : "#16a34a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
