import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConfidenceText } from "@/components/status-badge";
import {
  DEFAULT_LOCALE,
  getDictionary,
  homeOpportunityExplanation,
  marketSignalStrength,
  marketSignalStrengthLabel,
  type Locale
} from "@/lib/i18n";
import type { ValuationRow } from "@/lib/types/valuation";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

export function ValuationList({
  title,
  rows,
  tone,
  locale = DEFAULT_LOCALE,
  emptyMessage,
  id
}: {
  title: string;
  rows: ValuationRow[];
  tone: "positive" | "negative" | "neutral";
  locale?: Locale;
  emptyMessage?: string;
  id?: string;
}) {
  const t = getDictionary(locale);
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-red-300"
        : "text-zinc-400";

  return (
    <section id={id} className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {title}
        </h2>
        <span className={toneClass}>
          {tone === "positive"
            ? t.home.positiveTone
            : tone === "negative"
              ? t.home.negativeTone
              : t.status.fair}
        </span>
      </div>
      <div className="divide-y divide-line">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">
            {emptyMessage ?? t.status.fair}
          </div>
        ) : null}
        {rows.map((row) => (
          <Link
            key={row.slug}
            href={`/teams/${row.slug}`}
            className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 transition hover:bg-zinc-900"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-100">{row.name}</span>
                <span className={`font-mono text-sm font-semibold ${edgeTextClasses(row.edgeScore)}`}>
                  {signedPercent(row.edgeScore)}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                {homeOpportunityExplanation(row, locale)}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2 xl:grid-cols-4">
                <span>
                  {t.home.poly} {percent(row.polymarketProbability)}
                </span>
                <span>
                  {t.home.fair} {percent(row.fairProbability)}
                </span>
                <span>
                  {t.home.dataQuality}: <ConfidenceText confidence={row.confidence} locale={locale} />
                </span>
                <span>
                  {t.home.signalStrength}:{" "}
                  {marketSignalStrengthLabel(marketSignalStrength(row.edgeScore), locale)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-lg font-semibold ${edgeTextClasses(row.edgeScore)}`}>
                {signedPercent(row.edgeScore)}
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
