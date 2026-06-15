import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { TermTooltip } from "@/components/term-tooltip";
import { getLocale } from "@/lib/i18n-server";
import { getMarketSummaries } from "@/lib/services/opportunities";
import type { MarketSummary, MarketType } from "@/lib/types/opportunity";
import { signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const locale = await getLocale();
  const markets = await getMarketSummaries();
  const volumeIsLive = markets.some((market) => market.volumeSource === "LIVE_POLYMARKET");

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {locale === "zh" ? "世界杯市场列表" : "World Cup Markets"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "用于检查 CupEdge 已覆盖的世界杯市场。首页负责单场比赛研究，这里只保留市场列表、成交量和模型 Edge。"
              : "Review covered World Cup markets. The home page handles match research; this page keeps market coverage, volume, and model edge."}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="border-b border-line bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "市场" : "Market"}</th>
                <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "类型" : "Type"}</th>
                <th className="px-4 py-3 text-left font-medium">
                  <TermTooltip
                    term={locale === "zh" ? "层级" : "Tier"}
                    description={
                      locale === "zh"
                        ? "数据覆盖等级。实时价格和模型覆盖越完整，参考价值越高。"
                        : "Data coverage tier. Live pricing plus modeled fair value gives higher usefulness."
                    }
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <TermTooltip
                    term="Best Value Edge"
                    align="right"
                    description={
                      locale === "zh"
                        ? "该市场内最正向的价格差：公允概率高于市场价的最大幅度。"
                        : "The most positive pricing gap in this market: fair probability above market price."
                    }
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <TermTooltip
                    term="Lowest Value Edge"
                    align="right"
                    description={
                      locale === "zh"
                        ? "该市场内最负向的价格差：市场价高于公允概率的最大幅度。"
                        : "The most negative pricing gap in this market: market price above fair probability."
                    }
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <TermTooltip
                    term={volumeIsLive ? "Polymarket Volume" : "Volume"}
                    align="right"
                    description={
                      locale === "zh"
                        ? "该市场近期成交规模。成交量越高，价格通常越有参考价值。"
                        : "Recent traded volume. Higher volume usually makes the price more informative."
                    }
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <TermTooltip
                    term={locale === "zh" ? "覆盖项" : "Outcomes"}
                    align="right"
                    description={
                      locale === "zh"
                        ? "该市场下 CupEdge 已读取并展示的结果数量。"
                        : "The number of outcomes CupEdge has read and displays inside this market."
                    }
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {markets.length ? markets.map((market) => (
                <tr key={market.marketSlug} className={`hover:bg-zinc-900/70 ${marketRowTone(market)}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${marketDotClass(market)}`} aria-hidden="true" />
                      <span className="font-medium text-zinc-100">{market.marketTitle}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">{marketSignalText(market, locale)}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{marketTypeText(market.marketType, locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded border px-2 py-1 text-xs ${marketTierClass(market)}`}>
                      {marketTierText(market, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">
                    {signedPercent(market.bestEdge)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-300">
                    {signedPercent(market.worstEdge)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${market.volumeSource === "LIVE_POLYMARKET" ? "text-zinc-300" : "text-zinc-600"}`}>
                    {market.volumeSource === "LIVE_POLYMARKET" ? formatCompactNumber(market.volume24h) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">
                    {market.opportunityCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/markets/${market.marketSlug}`}
                      className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100"
                    >
                      {locale === "zh" ? "查看" : "Open"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                    {locale === "zh"
                      ? "暂无可展示的世界杯市场。"
                      : "No World Cup markets are available yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function marketTierText(market: MarketSummary, locale: "zh" | "en") {
  if (
    market.priceSource === "LIVE_POLYMARKET" &&
    market.volumeSource === "LIVE_POLYMARKET" &&
    (
      market.fairValueSource === "CUPEDGE_V2" ||
      market.fairValueSource === "MODEL" ||
      market.fairValueSource === "RATING_MODEL" ||
      market.fairValueSource === "QUANT_MODEL"
    )
  ) {
    return market.marketType === "WINNER"
      ? "Live Pricing"
      : "Model Coverage";
  }
  if (
    market.priceSource === "LIVE_POLYMARKET" &&
    market.volumeSource === "LIVE_POLYMARKET" &&
    market.fairValueSource === "BOOKMAKER"
  ) {
    return "Live Verified";
  }
  if (
    market.priceSource === "LIVE_POLYMARKET" &&
    market.volumeSource === "LIVE_POLYMARKET" &&
    market.fairValueSource === "RATING_FALLBACK"
  ) {
    return locale === "zh" ? "模型兜底" : "Model Fallback";
  }
  if (
    market.priceSource === "LIVE_POLYMARKET" &&
    market.volumeSource === "LIVE_POLYMARKET" &&
    market.fairValueSource === "UNMODELED"
  ) {
    return locale === "zh" ? "Live / 未建模" : "Live / Unmodeled";
  }
  return locale === "zh" ? "仅模型覆盖" : "Model Only";
}

function marketTierClass(market: MarketSummary) {
  if (market.fairValueSource === "UNMODELED" || market.fairValueSource === "RATING_FALLBACK") {
    return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
  if (market.priceSource === "LIVE_POLYMARKET" && market.volumeSource === "LIVE_POLYMARKET") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

function marketDotClass(market: MarketSummary) {
  if (market.fairValueSource === "UNMODELED" || market.fairValueSource === "RATING_FALLBACK") return "bg-zinc-600";
  if (market.bestEdge >= 0.35) return "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.55)]";
  if (market.worstEdge <= -0.05) return "bg-red-300 shadow-[0_0_12px_rgba(252,165,165,0.45)]";
  if (market.bestEdge >= 0.1) return "bg-amber-300";
  return "bg-zinc-700";
}

function marketRowTone(market: MarketSummary) {
  if (market.fairValueSource === "UNMODELED" || market.fairValueSource === "RATING_FALLBACK") return "bg-zinc-950/20";
  if (market.bestEdge >= 0.35) return "bg-emerald-500/[0.03]";
  if (market.worstEdge <= -0.05) return "bg-red-500/[0.03]";
  return "";
}

function marketSignalText(market: MarketSummary, locale: "zh" | "en") {
  if (market.fairValueSource === "UNMODELED") {
    return locale === "zh" ? "仅覆盖价格，暂不计算 Edge" : "Coverage only, no edge model yet";
  }
  if (market.fairValueSource === "RATING_FALLBACK") {
    return locale === "zh" ? "使用本地 seed fallback，等待 Elo/SPI 验证" : "Using local seed fallback, waiting for Elo/SPI verification";
  }
  if (market.bestEdge >= 0.35) {
    return locale === "zh" ? "存在明显价格差，优先查看 outcome" : "Clear pricing gap, inspect outcomes first";
  }
  if (market.worstEdge <= -0.05) {
    return locale === "zh" ? "存在可能过热 outcome" : "Possible overheated outcomes";
  }
  if (market.bestEdge >= 0.1) {
    return locale === "zh" ? "存在观察价值，适合继续跟踪" : "Watchlist pricing signal, monitor only";
  }
  return locale === "zh" ? "暂无明显价格差" : "No clear edge";
}

function marketTypeText(type: MarketType, locale: "zh" | "en") {
  const zh: Record<MarketType, string> = {
    WINNER: "冠军",
    GROUP_WINNER: "小组冠军",
    REACH_R16: "进入16强",
    REACH_QF: "进入四分之一决赛",
    REACH_SF: "进入半决赛",
    CONTINENT_WINNER: "洲际冠军",
    OTHER: "其他市场"
  };
  const en: Record<MarketType, string> = {
    WINNER: "Winner",
    GROUP_WINNER: "Group Winner",
    REACH_R16: "Reach R16",
    REACH_QF: "Reach QF",
    REACH_SF: "Reach SF",
    CONTINENT_WINNER: "Continent Winner",
    OTHER: "Other"
  };
  return locale === "zh" ? zh[type] : en[type];
}
