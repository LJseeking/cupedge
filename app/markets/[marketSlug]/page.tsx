import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { OpportunityCard, marketTypeText } from "@/components/opportunity-card";
import { ResearchInsightPanel } from "@/components/research-insight-panel";
import { getLocale } from "@/lib/i18n-server";
import { getMarketDetail } from "@/lib/services/opportunities";
import { getResearchInsightForMarket } from "@/lib/services/research-insights";
import { percent, signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params
}: {
  params: Promise<{ marketSlug: string }>;
}) {
  const locale = await getLocale();
  const { marketSlug } = await params;
  const detail = await getMarketDetail(marketSlug);
  if (!detail) notFound();
  const researchInsight = await getResearchInsightForMarket(detail.summary.marketSlug);
  const basket = detail.opportunities.find((item) => item.side === "BASKET");
  const volumeIsLive = detail.summary.volumeSource === "LIVE_POLYMARKET";
  const isDemoMode =
    detail.summary.priceSource !== "LIVE_POLYMARKET" ||
    detail.summary.volumeSource !== "LIVE_POLYMARKET" ||
    detail.summary.fairValueSource === "MOCK";

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/markets" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "返回市场列表" : "Back to markets"}
        </Link>

        <div className="mt-6 border-b border-line pb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
            {marketTypeText(detail.summary.marketType, locale)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {detail.summary.marketTitle}
          </h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Best Edge" value={signedPercent(detail.summary.bestEdge)} tone="positive" />
            <Metric label="Worst Edge" value={signedPercent(detail.summary.worstEdge)} tone="negative" />
            <Metric
              label={volumeIsLive ? "Polymarket Volume" : "Mock Volume"}
              value={volumeIsLive ? formatCompactNumber(detail.summary.volume24h) : "Mock"}
            />
            <Metric label="Liquidity" value={formatCompactNumber(detail.summary.liquidity)} />
          </div>
          {isDemoMode ? (
            <div className="mt-5 rounded border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
              <strong>Demo Mode.</strong>{" "}
              {locale === "zh"
                ? "该市场仍包含 mock/model 数据。Edge 是 CupEdge 模型指标，不是 Polymarket 官方指标。"
                : "This market still includes mock/model data. Edge is a CupEdge model metric, not an official Polymarket metric."}
            </div>
          ) : null}
        </div>

        {basket ? (
          <section className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-amber-200">
              Basket Monitor
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {locale === "zh"
                ? `YES basket 总价约 ${basket.sumYesBuyPrices?.toFixed(2)}，理论 basket edge 为 ${percent(
                    basket.basketEdge
                  )}。理论套利空间可能被滑点、盘口深度和真实成交价格吞噬。`
                : `YES basket totals about ${basket.sumYesBuyPrices?.toFixed(
                    2
                  )}, with theoretical basket edge of ${percent(
                    basket.basketEdge
                  )}. Slippage, depth, and real fill prices can consume this space.`}
            </p>
          </section>
        ) : null}

        <ResearchInsightPanel insight={researchInsight} locale={locale} />

        <section className="mt-6">
          <h2 className="mb-3 font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {locale === "zh" ? "市场内机会" : "Market Outcomes"}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {detail.opportunities.map((opportunity) => (
              <OpportunityCard
                key={`${opportunity.marketSlug}-${opportunity.outcomeName}-${opportunity.side}`}
                opportunity={opportunity}
                locale={locale}
              />
            ))}
          </div>
        </section>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-600">{label}</div>
      <div
        className={`mt-1 font-mono text-xl font-semibold ${
          tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}
