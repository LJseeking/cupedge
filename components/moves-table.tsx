import Link from "next/link";
import { DEFAULT_LOCALE, getDictionary, signalLabel, type Locale } from "@/lib/i18n";
import type { MoveSignal, TeamMove } from "@/lib/types/valuation";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

export function MovesTable({
  moves,
  locale = DEFAULT_LOCALE
}: {
  moves: TeamMove[];
  locale?: Locale;
}) {
  const t = getDictionary(locale);

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="min-w-[880px] w-full border-collapse text-sm">
        <thead className="border-b border-line bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t.table.team}</th>
            <th className="px-4 py-3 text-right font-medium">{t.moves.previousPolymarket}</th>
            <th className="px-4 py-3 text-right font-medium">{t.moves.currentPolymarket}</th>
            <th className="px-4 py-3 text-right font-medium">{t.moves.change}</th>
            <th className="px-4 py-3 text-right font-medium">{t.moves.previousEdge}</th>
            <th className="px-4 py-3 text-right font-medium">{t.moves.currentEdge}</th>
            <th className="px-4 py-3 text-left font-medium">{t.moves.signal}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {moves.map((move) => (
            <tr key={move.slug} className="transition hover:bg-zinc-900/70">
              <td className="whitespace-nowrap px-4 py-3">
                <Link href={`/teams/${move.slug}`} className="font-medium text-zinc-100 hover:underline">
                  {move.team}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                {percent(move.previousPolymarket)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                {percent(move.currentPolymarket)}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${edgeTextClasses(
                  -move.change
                )}`}
              >
                {signedPercent(move.change)}
              </td>
              <td className={`whitespace-nowrap px-4 py-3 text-right font-mono ${edgeTextClasses(move.previousEdge)}`}>
                {signedPercent(move.previousEdge)}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${edgeTextClasses(
                  move.currentEdge
                )}`}
              >
                {signedPercent(move.currentEdge)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <SignalBadge signal={move.signal} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignalBadge({ signal, locale }: { signal: MoveSignal; locale: Locale }) {
  const classes: Record<MoveSignal, string> = {
    became_cheaper: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    became_expensive: "border-red-500/30 bg-red-500/10 text-red-300",
    new_value_signal: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    overheat_signal: "border-red-500/40 bg-red-500/15 text-red-200",
    stable: "border-zinc-700 bg-zinc-800 text-zinc-300"
  };

  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${classes[signal]}`}>
      {signalLabel(signal, locale)}
    </span>
  );
}
