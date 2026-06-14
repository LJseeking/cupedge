import Link from "next/link";
import { BookOpen, ExternalLink, Radar, TrendingUp } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { MetricCard } from "@/components/metric-card";
import { dataQualityText, executionStatusText, OpportunityCard, signalText } from "@/components/opportunity-card";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getMarketOpportunities } from "@/lib/services/opportunities";
import {
  getOpportunityTrustTier,
  isTrustedHomeSignal,
  trustTierClasses,
  trustTierText
} from "@/lib/services/opportunity-trust";
import { getUpcomingMatches } from "@/lib/services/upcoming-matches";
import type { MarketOpportunity } from "@/lib/types/opportunity";
import type { UpcomingMatch } from "@/lib/types/research";
import { percent, signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [opportunities, upcomingMatches] = await Promise.all([
    getMarketOpportunities(),
    getUpcomingMatches(3)
  ]);
  const liveVerified = opportunities.filter((item) => getOpportunityTrustTier(item) === "LIVE_VERIFIED");
  const modelWatchlist = opportunities.filter((item) => getOpportunityTrustTier(item) === "MODEL_WATCHLIST");
  const trustedOpportunities = [...liveVerified, ...modelWatchlist];
  const gradedOpportunities = opportunities.filter(isTrustedHomeSignal);
  const shortHorizonOpportunities = gradedOpportunities.filter(isHomepageDecisionSignal);
  const longTermWatchlist = gradedOpportunities
    .filter((item) => !isHomepageDecisionSignal(item))
    .sort((a, b) => b.actionableScore - a.actionableScore)
    .slice(0, 3);
  const actionableWatchlist = shortHorizonOpportunities
    .sort((a, b) => b.actionableScore - a.actionableScore)
    .slice(0, 3);
  const biggestPositiveEdge = Math.max(...trustedOpportunities.map((item) => item.edgeScore), 0);
  const updatedAt = newestUpdate(opportunities);
  const topPick = pickTopOpportunity(shortHorizonOpportunities);
  const nextMatch = upcomingMatches[0] ?? null;
  const marketRead = buildMarketRead(shortHorizonOpportunities.length, topPick, nextMatch, locale);
  const suitableForAction = topPick?.executionStatus === "ACTIONABLE_WATCH";

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-mono text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
              CupEdge
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-zinc-300">
              {locale === "zh"
                ? "世界杯比赛盘口、公允概率和 Edge。"
                : "World Cup match odds, fair probabilities, and edge."}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              {locale === "zh"
                ? "先看即将开赛，再看 Polymarket 价格、公允概率和模型解释。不是推荐下注，也不承诺收益。"
                : "Start with upcoming matches, then compare Polymarket prices, fair value, and model reasoning."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
            >
              <Radar className="h-4 w-4" aria-hidden="true" />
              {locale === "zh" ? "查看全部机会" : "View Opportunities"}
            </Link>
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
            >
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              {locale === "zh" ? "市场列表" : "Markets"}
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t.home.methodology}
            </Link>
          </div>
        </div>

        <UpcomingMatchesSection matches={upcomingMatches} locale={locale} />

        <section className="mb-6 border-y border-line py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {locale === "zh" ? "Today’s Market Call / 今日市场判断" : "Today’s Market Call"}
              </p>
              <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-zinc-100">
                {marketRead}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
                {locale === "zh"
                  ? suitableForAction
                    ? "当前存在 A/B 级观察信号，但仍需看价格区间、流动性和数据来源。CupEdge 不是投资、博彩或交易建议。"
                    : "当前更适合当作观赛观察清单，不适合把它理解为明确行动信号。CupEdge 不是投资、博彩或交易建议。"
                  : suitableForAction
                    ? "A/B grade signals exist, but price zone, liquidity, and data source still matter. CupEdge is not financial, betting, or trading advice."
                    : "Not suitable for direct action right now. Monitor alerts and signal changes first. CupEdge is not financial, betting, or trading advice."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
              <MetricCard label={locale === "zh" ? "可用实时机会" : "Live Signals"} value={String(liveVerified.length)} tone={liveVerified.length ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "最大 Edge" : "Max Edge"} value={signedPercent(biggestPositiveEdge)} tone={biggestPositiveEdge >= 0.1 ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "最后更新" : "Last Updated"} value={updatedAt} />
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {locale === "zh" ? "Near-term Pick" : "Near-term Pick"}
            </h2>
            <span className="text-xs text-zinc-500">
              {locale === "zh" ? "只看近期可验证市场" : "Short-horizon signals only"}
            </span>
          </div>
          {topPick ? (
            <TopPickCard opportunity={topPick} locale={locale} />
          ) : (
            <div className="rounded-lg border border-line bg-panel p-5 text-sm text-zinc-500">
              {locale === "zh" ? "今日暂无近期首选机会。长期世界杯 futures 已降级到观察清单，避免把赛程信息滞后的市场当作今日判断。" : "No near-term top pick today. Long-range World Cup futures stay in the watchlist instead of the daily decision layer."}
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {locale === "zh" ? "Actionable Watchlist" : "Actionable Watchlist"}
            </h2>
            <Link href="/opportunities?signal=watchlist" className="text-xs text-zinc-500 hover:text-zinc-200">
              {locale === "zh" ? "查看全部" : "View all"}
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {actionableWatchlist.length ? actionableWatchlist.map((opportunity) => (
              <OpportunityCard key={`${opportunity.marketSlug}-${opportunity.outcomeName}-${opportunity.side}`} opportunity={opportunity} locale={locale} />
            )) : (
              <div className="rounded-lg border border-line bg-panel p-5 text-sm text-zinc-500 lg:col-span-3">
                {locale === "zh" ? "暂无 A/B 级可观察机会，先看上方即将开赛比赛。" : "No A/B grade actionable watch opportunities right now. Start with the upcoming matches above."}
              </div>
            )}
          </div>
        </section>

        {longTermWatchlist.length ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
                {locale === "zh" ? "长期 Futures 观察" : "Long-term Futures Watchlist"}
              </h2>
              <span className="text-xs text-zinc-500">
                {locale === "zh" ? "不会进入今日首选" : "Excluded from daily top pick"}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {longTermWatchlist.map((opportunity) => (
                <OpportunityCard key={`${opportunity.marketSlug}-${opportunity.outcomeName}-${opportunity.side}`} opportunity={opportunity} locale={locale} />
              ))}
            </div>
          </section>
        ) : null}

      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function UpcomingMatchesSection({
  matches,
  locale
}: {
  matches: UpcomingMatch[];
  locale: "zh" | "en";
}) {
  return (
    <section className="mb-6 border-b border-line pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {locale === "zh" ? "Upcoming Matches / 即将开赛" : "Upcoming Matches"}
        </h2>
        <span className="text-xs text-zinc-500">
          {locale === "zh" ? "CCTV 官方赛程 + CupEdge 公允概率" : "Official schedule + CupEdge fair probabilities"}
        </span>
      </div>
      {matches.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {matches.map((match) => (
            <UpcomingMatchCard key={match.matchSlug} match={match} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-panel p-5 text-sm text-zinc-500">
          {locale === "zh" ? "暂无即将开赛比赛。" : "No upcoming matches yet."}
        </div>
      )}
    </section>
  );
}

function UpcomingMatchCard({
  match,
  locale
}: {
  match: UpcomingMatch;
  locale: "zh" | "en";
}) {
  const time = formatMatchTime(match.startTime, locale);
  const hasMarketPrices = [match.homeProbability, match.drawProbability, match.awayProbability].every(
    (value) => value !== null && value !== undefined
  );
  const edgeLabel = hasMarketPrices
    ? "Edge"
    : locale === "zh"
      ? "模型 Edge"
      : "Model Edge";
  const marketRows = [
    {
      label: match.homeTeam,
      market: match.homeProbability,
      fair: match.fairHomeProbability
    },
    {
      label: locale === "zh" ? "平局" : "Draw",
      market: match.drawProbability,
      fair: match.fairDrawProbability
    },
    {
      label: match.awayTeam,
      market: match.awayProbability,
      fair: match.fairAwayProbability
    }
  ];
  const displayRows = marketRows.map((row) => ({
    ...row,
    edge: edgeValue(row.fair, row.market, marketRows.length)
  }));
  const bestEdgeRow = [...displayRows].sort((a, b) => b.edge - a.edge)[0];
  const sourceCount = countResearchSources(match.researchSources);
  const fairProbabilityNote =
    locale === "zh"
      ? hasMarketPrices
        ? "Edge = CupEdge 公允概率 - Polymarket 价格。先看正 Edge，再看模型解释是否支持。"
        : "当前未匹配到 Polymarket 盘口，只显示 CupEdge 公允概率和模型倾斜度。"
      : hasMarketPrices
        ? "Edge = CupEdge fair probability minus Polymarket price. Check positive edge first, then model support."
        : "No matched Polymarket market yet. This only shows CupEdge fair probability and model tilt.";

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="border-b border-line bg-zinc-950/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-zinc-600">{time}</p>
          <h3 className="mt-2 truncate text-xl font-semibold text-zinc-100">
            {match.homeTeam} vs {match.awayTeam}
          </h3>
          {match.marketSourceUrl ? (
            <a
              href={match.marketSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200"
            >
              {hasMarketPrices ? "Polymarket" : locale === "zh" ? "CCTV 官方赛程" : "Official schedule"}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
          <div className="shrink-0 rounded border border-line bg-zinc-950 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-600">
            {locale === "zh" ? "LLM 修正" : "LLM Adjustment"}
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
            {signedPercent(match.llmAdjustment)}
          </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded border border-line bg-zinc-950/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-600">
              {locale === "zh" ? "最佳差值" : "Best Edge"}
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold ${edgeTone(bestEdgeRow?.edge ?? 0)}`}>
              {signedPercent(bestEdgeRow?.edge ?? 0)}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500">{bestEdgeRow?.label}</div>
          </div>
          <div className="rounded border border-line bg-zinc-950/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-600">
              {locale === "zh" ? "搜索来源" : "Sources"}
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {sourceCount || "—"}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500">
              {hasMarketPrices
                ? locale === "zh" ? "盘口已匹配" : "Market matched"
                : locale === "zh" ? "盘口未匹配" : "Market unmatched"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
            <span>{locale === "zh" ? "结果" : "Outcome"}</span>
            <span>{locale === "zh" ? "市场" : "Market"}</span>
            <span>{locale === "zh" ? "公允" : "Fair"}</span>
            <span>{edgeLabel}</span>
          </div>
          {displayRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm">
            <span className="min-w-0 truncate text-zinc-300">{row.label}</span>
            <span className="font-mono text-zinc-500">{formatOptionalPercent(row.market, locale)}</span>
            <span className="font-mono text-zinc-100">{percent(row.fair)}</span>
            <span className={`font-mono ${edgeTone(row.edge)}`}>
              {signedPercent(row.edge)}
            </span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-line pt-3 text-xs leading-5 text-zinc-500">
        {fairProbabilityNote}
        </p>

        {(match.deepseekResearch || match.gptSummary) ? (
          <div className="mt-4 rounded border border-line bg-zinc-950/40">
            <div className="grid gap-0 sm:grid-cols-2">
              <ResearchPreview
                title={locale === "zh" ? "DeepSeek 要点" : "DeepSeek Notes"}
                value={match.deepseekResearch}
                kind="deepseek"
                locale={locale}
              />
              <ResearchPreview
                title={locale === "zh" ? "Gemini 判断" : "Gemini View"}
                value={match.gptSummary}
                kind="gemini"
                locale={locale}
              />
            </div>
            <details className="border-t border-line px-3 py-2 text-xs text-zinc-500">
              <summary className="cursor-pointer select-none font-mono text-zinc-400">
                {locale === "zh" ? "展开完整中英研究" : "Show full bilingual research"}
              </summary>
              <div className="mt-3 grid gap-3 leading-5 sm:grid-cols-2">
                <p className="whitespace-pre-line">{formatBilingualSummary(match.deepseekResearch, "deepseek", locale)}</p>
                <p className="whitespace-pre-line">{formatBilingualSummary(match.gptSummary, "gemini", locale)}</p>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ResearchPreview({
  title,
  value,
  kind,
  locale
}: {
  title: string;
  value: string | null | undefined;
  kind: "deepseek" | "gemini";
  locale: "zh" | "en";
}) {
  return (
    <div className="min-h-[104px] border-b border-line p-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="font-mono text-xs text-zinc-300">{title}</div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">
        {compactResearchSummary(value, kind, locale)}
      </p>
    </div>
  );
}

function formatMatchTime(value: Date | string | null | undefined, locale: "zh" | "en") {
  if (!value) return locale === "zh" ? "时间待确认" : "Time TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "zh" ? "时间待确认" : "Time TBD";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatOptionalPercent(value: number | null | undefined, locale: "zh" | "en") {
  if (value === null || value === undefined) return locale === "zh" ? "未匹配" : "unmatched";
  return percent(value);
}

function edgeValue(fair: number | null | undefined, market: number | null | undefined, outcomeCount = 3) {
  if (fair === null || fair === undefined) return 0;
  if (market !== null && market !== undefined) return fair - market;
  return fair - (1 / outcomeCount);
}

function edgeTone(value: number) {
  if (value >= 0.02) return "text-emerald-300";
  if (value <= -0.02) return "text-red-300";
  return "text-zinc-500";
}

function formatBilingualSummary(
  value: string | null | undefined,
  kind: "deepseek" | "gemini",
  locale: "zh" | "en"
) {
  if (!value) return locale === "zh" ? "中文：暂无摘要。\nEnglish: No summary yet." : "English: No summary yet.\n中文：暂无摘要。";
  const trimmed = value.trim();
  if (hasBilingualMarkers(trimmed)) return trimmed;
  const zhFallback = kind === "deepseek"
    ? "中文：当前展示的是旧版英文研究摘要。部署新版本并重新触发 update-data 后，DeepSeek 会写入中文和英文两个版本。"
    : "中文：当前展示的是旧版英文总结。部署新版本并重新触发 update-data 后，Gemini 会写入中文和英文两个版本。";
  return `${zhFallback}\nEnglish: ${trimmed}`;
}

function hasBilingualMarkers(value: string) {
  return /中文[:：]/.test(value) && /English\s*:/i.test(value);
}

function compactResearchSummary(
  value: string | null | undefined,
  kind: "deepseek" | "gemini",
  locale: "zh" | "en"
) {
  const summary = formatBilingualSummary(value, kind, locale);
  const localized = locale === "zh" ? extractChineseSection(summary) : extractEnglishSection(summary);
  return trimToSentence(localized || summary, locale === "zh" ? 96 : 120);
}

function extractChineseSection(value: string) {
  const match = value.match(/中文[:：]\s*([\s\S]*?)(?:English\s*:|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractEnglishSection(value: string) {
  const match = value.match(/English\s*:\s*([\s\S]*)/i);
  return match?.[1]?.trim() ?? "";
}

function trimToSentence(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).replace(/[，,。.\s]+$/u, "")}…`;
}

function countResearchSources(value: string | null | undefined) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length;
    if (Array.isArray(parsed?.sources)) return parsed.sources.length;
  } catch {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }
  return 0;
}

function TopPickCard({
  opportunity,
  locale
}: {
  opportunity: MarketOpportunity;
  locale: "zh" | "en";
}) {
  const tier = getOpportunityTrustTier(opportunity);
  const whyTopPick =
    locale === "zh"
      ? `${opportunity.outcomeName} ${opportunity.side} 是当前 ${signalText(opportunity.signalStrength, locale)} 中关注分最高的信号，赔率价值为 ${signedPercent(
          opportunity.edgeScore
        )}，数据质量为 ${dataQualityText(opportunity.dataQuality, locale)}。`
      : `${opportunity.outcomeName} ${opportunity.side} has the highest actionableScore among current ${signalText(opportunity.signalStrength, locale)} signals, with ${signedPercent(
          opportunity.edgeScore
        )} value edge and ${opportunity.dataQuality} data quality.`;
  const mainRisk =
    locale === "zh"
      ? "最大风险是流动性、盘口深度和公允概率估计变化导致信号快速减弱。"
      : "The main risk is that liquidity, orderbook depth, or updated fair value estimates weaken the signal quickly.";

  return (
    <article className="border-y border-line py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{opportunity.marketTitle}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {opportunity.outcomeName} {opportunity.side}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-line bg-zinc-950 px-2 py-1 text-zinc-300">
              Grade {opportunity.opportunityGrade}
            </span>
            <span className="rounded border border-line bg-zinc-950 px-2 py-1 text-zinc-300">
              {executionStatusText(opportunity.executionStatus, locale)}
            </span>
            <span className={`rounded border px-2 py-1 ${trustTierClasses(tier)}`}>
              {trustTierText(tier, locale)}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{whyTopPick}</p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500">{mainRisk}</p>
        </div>
        <div className="grid min-w-full gap-3 sm:grid-cols-2 lg:min-w-[460px]">
          <MetricCard
            label={
              opportunity.priceSource === "LIVE_POLYMARKET"
                ? locale === "zh"
                  ? "当前价格"
                  : "Current Price"
                : "Mock Price"
            }
            value={percent(opportunity.polymarketProbability)}
          />
          <MetricCard label={locale === "zh" ? "模型概率" : "Fair Probability"} value={percent(opportunity.fairProbability)} />
          <MetricCard label={locale === "zh" ? "赔率价值" : "Value Edge"} value={signedPercent(opportunity.edgeScore)} tone="positive" />
          <MetricCard label={locale === "zh" ? "关注分" : "Action Score"} value={String(Math.round(opportunity.actionableScore))} tone="positive" />
          <MetricCard label={locale === "zh" ? "观察价" : "Watch Below"} value={percent(opportunity.watchBelow)} />
          <MetricCard label={locale === "zh" ? "失效价" : "Invalid At"} value={percent(opportunity.invalidAt)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/opportunities/${opportunity.id ?? opportunity.marketSlug}`}
          className="inline-flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15"
        >
          <Radar className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "完整分析" : "View Full Analysis"}
        </Link>
        <Link
          href={`/markets/${opportunity.marketSlug}`}
          className="inline-flex items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
        >
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "查看市场" : "View Market"}
        </Link>
      </div>
    </article>
  );
}

function newestUpdate(opportunities: MarketOpportunity[]) {
  const latest = Math.max(...opportunities.map((item) => new Date(item.updatedAt).getTime()));
  if (!Number.isFinite(latest)) return "n/a";
  return new Date(latest).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pickTopOpportunity(candidates: MarketOpportunity[]) {
  return [...candidates].sort((a, b) => b.actionableScore - a.actionableScore)[0] ?? null;
}

function isHomepageDecisionSignal(opportunity: MarketOpportunity) {
  if (opportunity.side === "BASKET") return true;
  return opportunity.marketType === "OTHER";
}

function buildMarketRead(
  gradedCount: number,
  topPick: MarketOpportunity | null,
  nextMatch: UpcomingMatch | null,
  locale: "zh" | "en"
) {
  if (nextMatch) {
    const time = formatMatchTime(nextMatch.startTime, locale);
    return locale === "zh"
      ? `下一场先看 ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}（${time}），首页只把近期比赛放进今日判断。`
      : `Next up: ${nextMatch.homeTeam} vs ${nextMatch.awayTeam} (${time}). The home page decision layer now prioritizes near-term matches.`;
  }
  if (gradedCount > 0 && topPick) {
    const tier = getOpportunityTrustTier(topPick);
    return locale === "zh"
      ? `今日发现 ${gradedCount} 个可信 A/B 级机会，首选为 ${topPick.outcomeName} ${topPick.side}，层级为 ${trustTierText(tier, locale)}。`
      : `${gradedCount} trusted A/B grade opportunities found today. Top pick is ${topPick.outcomeName} ${topPick.side}, tier ${trustTierText(tier, locale)}.`;
  }
  return locale === "zh"
    ? "今日暂无可信 A/B 级机会。Demo 或轻微信号只适合复核，不进入首页决策层。"
    : "No trusted A/B grade opportunities today. Demo or mild signals stay in review, not the decision layer.";
}
