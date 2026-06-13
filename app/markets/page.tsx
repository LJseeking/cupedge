import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Target } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { marketTypeText } from "@/components/opportunity-card";
import { getLocale } from "@/lib/i18n-server";
import { getMarketSummaries } from "@/lib/services/opportunities";
import type { MarketSummary } from "@/lib/types/opportunity";
import { signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const locale = await getLocale();
  const markets = await getMarketSummaries();
  const sourceStatus = getSourceStatus(markets);
  const isDemoMode =
    sourceStatus.markets !== "Live" ||
    sourceStatus.prices !== "Live" ||
    sourceStatus.volume !== "Live" ||
    sourceStatus.fairValue === "Mock";
  const volumeIsLive = sourceStatus.volume === "Live";
  const volumeIsMixed = sourceStatus.volume === "Mixed";
  const radar = buildMarketRadar(markets);

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {locale === "zh" ? "世界杯市场列表" : "World Cup Markets"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? volumeIsLive
                ? "按 Polymarket 官方市场成交量排序，进入单个市场查看 outcome、YES/NO、Value Edge 与 basket 监控。"
                : volumeIsMixed
                  ? "当前包含 live 与 demo 市场；真实成交量逐行显示，demo 市场显示 Mock。"
                  : "当前为 Demo Mode，成交量不是 Polymarket 官方实时数据；市场列表按名称排序。"
              : volumeIsLive
                ? "Sorted by official Polymarket market volume. Open a market to inspect outcomes, YES/NO value edges, and basket monitoring."
                : volumeIsMixed
                  ? "Mixed live/demo markets. Live rows show Polymarket volume; demo rows show Mock."
                  : "Demo Mode: volume is not live Polymarket data, so markets are sorted by name."}
          </p>
        </div>

        <section className="mb-6 border-y border-line py-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <SourceItem label="Polymarket Markets" value={sourceStatus.markets} />
            <SourceItem label="Polymarket Prices" value={sourceStatus.prices} />
            <SourceItem label="Polymarket Volume" value={sourceStatus.volume} />
            <SourceItem label="Fair Value" value={sourceStatus.fairValue} />
            <SourceItem label="Last Sync Time" value={sourceStatus.lastSync} muted />
          </div>
          {isDemoMode ? (
            <div className="mt-4 rounded border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
              <strong>Demo Mode.</strong>{" "}
              {locale === "zh"
                ? "当前市场价格、成交量或公允概率仍含 mock/model 数据。页面不会把 mock volume 当作 Polymarket 官方成交量展示，强信号会降级为 Demo Signal。"
                : "Current market prices, volume, or fair values include mock/model data. Mock volume is not shown as official Polymarket volume, and strong signals are downgraded to Demo Signal."}
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            {locale === "zh"
              ? "市场价格与成交量在接入真实数据时来自 Polymarket。Value Edge 由 CupEdge 模型按赔率结构计算，不是 Polymarket 官方指标。"
              : "Market price and volume come from Polymarket when live data is connected. Value Edge is calculated by CupEdge from price and fair probability, not a Polymarket official metric."}
          </p>
        </section>

        <section className="mb-6 overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  {locale === "zh" ? "机会雷达" : "Opportunity Radar"}
                </div>
                <h2 className="mt-3 text-xl font-semibold text-zinc-100">
                  {locale === "zh" ? "先看这些市场" : "Start With These Markets"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                  {locale === "zh"
                    ? "这里把可计算 Value Edge 的市场和仅覆盖的 Polymarket 市场分开。绿色代表潜在赔率价值，未建模市场只用于覆盖浏览。"
                    : "This separates modeled value-edge markets from coverage-only Polymarket markets. Green indicates potential price/fair-value upside; unmodeled markets are coverage only."}
                </p>
              </div>
              <Link
                href="/opportunities"
                className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                {locale === "zh" ? "查看全部机会" : "View All Signals"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid gap-px bg-line md:grid-cols-4">
            <RadarMetric
              label={locale === "zh" ? "强信号市场" : "Strong Signal Markets"}
              value={String(radar.strongCount)}
              tone="positive"
            />
            <RadarMetric
              label={locale === "zh" ? "最大价值 Edge" : "Biggest Value Edge"}
              value={signedPercent(radar.biggestPositive)}
              tone="positive"
            />
            <RadarMetric
              label={locale === "zh" ? "可能过热市场" : "Possible Overheated Markets"}
              value={String(radar.overheatedCount)}
              tone="negative"
            />
            <RadarMetric
              label={locale === "zh" ? "仅覆盖市场" : "Coverage Only"}
              value={String(radar.coverageOnlyCount)}
              tone="neutral"
            />
          </div>

          {radar.highlights.length ? (
            <div className="grid gap-px bg-line lg:grid-cols-3">
              {radar.highlights.map((market) => (
                <MarketHighlightCard key={market.marketSlug} market={market} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-sm text-zinc-500">
              {locale === "zh"
                ? "当前没有明显强信号市场。可以继续查看完整市场覆盖，但不应把覆盖市场视为机会。"
                : "No clear strong signal markets right now. You can still review market coverage, but coverage-only rows are not opportunity signals."}
            </div>
          )}
        </section>

        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="border-b border-line bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "市场" : "Market"}</th>
                <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "类型" : "Type"}</th>
                <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "层级" : "Tier"}</th>
                <th className="px-4 py-3 text-right font-medium">Best Value Edge</th>
                <th className="px-4 py-3 text-right font-medium">Lowest Value Edge</th>
                <th className="px-4 py-3 text-right font-medium">
                  {volumeIsLive ? "Polymarket Volume" : volumeIsMixed ? "Volume" : "Mock Volume"}
                </th>
                <th className="px-4 py-3 text-right font-medium">{locale === "zh" ? "机会数" : "Signals"}</th>
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
                    {market.volumeSource === "LIVE_POLYMARKET" ? formatCompactNumber(market.volume24h) : "Mock"}
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
                      ? "暂无 live Polymarket 市场数据。请运行 npm run update:data；如果 Polymarket API 请求失败，CupEdge 不会展示 mock 价格。"
                      : "No live Polymarket market data yet. Run npm run update:data; if Polymarket API fails, CupEdge will not show mock prices."}
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

function SourceItem({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  const isLive = value === "Live" || value === "Model" || value === "BOOKMAKER";
  const isNeutral = value === "Unmodeled" || value === "Mixed";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-600">{label}</div>
      <div
        className={`mt-1 font-mono text-sm font-semibold ${
          muted ? "text-zinc-400" : isLive ? "text-emerald-300" : isNeutral ? "text-zinc-300" : "text-amber-300"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function RadarMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-red-300"
        : "text-zinc-200";

  return (
    <div className="bg-panel px-4 py-4 sm:px-5">
      <div className="text-xs uppercase tracking-wide text-zinc-600">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MarketHighlightCard({ market, locale }: { market: MarketSummary; locale: "zh" | "en" }) {
  const isOverheated = market.worstEdge <= -0.05 && Math.abs(market.worstEdge) >= Math.abs(market.bestEdge);
  const iconClass = isOverheated ? "text-red-300" : "text-emerald-300";
  const edgeValue = isOverheated ? market.worstEdge : market.bestEdge;

  return (
    <Link
      href={`/markets/${market.marketSlug}`}
      className="group block bg-panel px-4 py-5 transition hover:bg-zinc-900/75 sm:px-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${iconClass}`}>
            {isOverheated ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Target className="h-4 w-4" aria-hidden="true" />
            )}
            {isOverheated
              ? locale === "zh"
                ? "可能过热"
                : "Possible Overheated"
              : locale === "zh"
                ? "潜在价值"
                : "Potential Value"}
          </div>
          <h3 className="mt-3 line-clamp-2 font-semibold text-zinc-100">{market.marketTitle}</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {marketTypeText(market.marketType, locale)} / {marketTierText(market, locale)}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-zinc-100" aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-600">
            {isOverheated ? "Lowest Value Edge" : "Best Value Edge"}
          </div>
          <div className={`mt-1 font-mono text-2xl font-semibold ${isOverheated ? "text-red-300" : "text-emerald-300"}`}>
            {signedPercent(edgeValue)}
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>{locale === "zh" ? "市场量" : "Volume"}</div>
          <div className="mt-1 font-mono text-zinc-300">
            {market.volumeSource === "LIVE_POLYMARKET" ? formatCompactNumber(market.volume24h) : "Mock"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function getSourceStatus(markets: Awaited<ReturnType<typeof getMarketSummaries>>) {
  const allPriceLive = markets.length > 0 && markets.every((market) => market.priceSource === "LIVE_POLYMARKET");
  const allVolumeLive = markets.length > 0 && markets.every((market) => market.volumeSource === "LIVE_POLYMARKET");
  const anyPriceLive = markets.some((market) => market.priceSource === "LIVE_POLYMARKET");
  const anyVolumeLive = markets.some((market) => market.volumeSource === "LIVE_POLYMARKET");
  const fairValueSources = new Set(markets.map((market) => market.fairValueSource));
  const latest = Math.max(...markets.map((market) => new Date(market.updatedAt).getTime()));

  return {
    markets: allPriceLive ? "Live" : anyPriceLive ? "Mixed" : "Mock",
    prices: allPriceLive ? "Live" : anyPriceLive ? "Mixed" : "Mock",
    volume: allVolumeLive ? "Live" : anyVolumeLive ? "Mixed" : "Mock",
    fairValue:
      fairValueSources.size === 1 && fairValueSources.has("CUPEDGE_V2")
        ? "CupEdge v2"
        : fairValueSources.size === 1 && (fairValueSources.has("MODEL") || fairValueSources.has("RATING_MODEL") || fairValueSources.has("QUANT_MODEL"))
        ? "Model"
        : fairValueSources.size === 1 && fairValueSources.has("RATING_FALLBACK")
          ? "Rating Fallback"
        : fairValueSources.size === 1 && fairValueSources.has("BOOKMAKER")
          ? "BOOKMAKER"
          : fairValueSources.size === 1 && fairValueSources.has("UNMODELED")
            ? "Unmodeled"
          : fairValueSources.size > 1
            ? "Mixed"
            : "Mock",
    lastSync: Number.isFinite(latest)
      ? new Date(latest).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "n/a"
  };
}

function buildMarketRadar(markets: MarketSummary[]) {
  const modeled = markets.filter(
    (market) =>
      market.fairValueSource !== "UNMODELED" &&
      market.fairValueSource !== "MOCK" &&
      market.fairValueSource !== "RATING_FALLBACK"
  );
  const strong = modeled.filter((market) => market.bestEdge >= 0.1);
  const overheated = modeled.filter((market) => market.worstEdge <= -0.05);
  const highlights = dedupeMarketHighlights([
    ...strong.sort((a, b) => b.bestEdge - a.bestEdge).slice(0, 2),
    ...overheated.sort((a, b) => a.worstEdge - b.worstEdge).slice(0, 1)
  ]);

  return {
    strongCount: strong.length,
    overheatedCount: overheated.length,
    coverageOnlyCount: markets.filter((market) => market.fairValueSource === "UNMODELED").length,
    biggestPositive: modeled.length ? Math.max(...modeled.map((market) => market.bestEdge)) : 0,
    highlights
  };
}

function dedupeMarketHighlights(markets: MarketSummary[]) {
  const bySlug = new Map<string, MarketSummary>();
  for (const market of markets) {
    if (!bySlug.has(market.marketSlug)) bySlug.set(market.marketSlug, market);
  }
  return [...bySlug.values()].slice(0, 3);
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
      ? "Live Verified"
      : "Model Watchlist";
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
    return locale === "zh" ? "Fallback / 待验证" : "Fallback / Needs Verification";
  }
  if (
    market.priceSource === "LIVE_POLYMARKET" &&
    market.volumeSource === "LIVE_POLYMARKET" &&
    market.fairValueSource === "UNMODELED"
  ) {
    return locale === "zh" ? "Live / 未建模" : "Live / Unmodeled";
  }
  return locale === "zh" ? "Demo / 待验证" : "Demo / Needs Verification";
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
    return locale === "zh" ? "仅覆盖价格，暂不计算机会" : "Coverage only, no edge model yet";
  }
  if (market.fairValueSource === "RATING_FALLBACK") {
    return locale === "zh" ? "使用本地 seed fallback，等待 Elo/SPI 验证" : "Using local seed fallback, waiting for Elo/SPI verification";
  }
  if (market.bestEdge >= 0.35) {
    return locale === "zh" ? "存在明显赔率价值，优先查看 outcome" : "Clear value edge, inspect outcomes first";
  }
  if (market.worstEdge <= -0.05) {
    return locale === "zh" ? "存在可能过热 outcome，避免追高" : "Possible overheated outcomes, avoid chasing";
  }
  if (market.bestEdge >= 0.1) {
    return locale === "zh" ? "存在观察价值，适合继续跟踪" : "Watchlist value signal, monitor only";
  }
  return locale === "zh" ? "暂无明显机会" : "No clear edge";
}
