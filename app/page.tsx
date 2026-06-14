import Link from "next/link";
import { Bell, BookOpen, Eye, Flame, Radar, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { MetricCard } from "@/components/metric-card";
import { dataQualityText, executionStatusText, OpportunityCard, signalText } from "@/components/opportunity-card";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getMarketOpportunities } from "@/lib/services/opportunities";
import {
  getOpportunityTrustTier,
  isTrustedHomeSignal,
  isTrustedOverheatedSignal,
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
  const demoSignals = opportunities.filter((item) => getOpportunityTrustTier(item) === "DEMO_NEEDS_VERIFICATION");
  const trustedOpportunities = [...liveVerified, ...modelWatchlist];
  const gradedOpportunities = opportunities.filter(isTrustedHomeSignal);
  const shortHorizonOpportunities = gradedOpportunities.filter(isHomepageDecisionSignal);
  const longTermWatchlist = gradedOpportunities
    .filter((item) => !isHomepageDecisionSignal(item))
    .sort((a, b) => b.actionableScore - a.actionableScore)
    .slice(0, 3);
  const overheated = opportunities.filter(isTrustedOverheatedSignal);
  const basketSignals = opportunities.filter((item) => item.side === "BASKET" && getOpportunityTrustTier(item) !== "DEMO_NEEDS_VERIFICATION");
  const actionableWatchlist = shortHorizonOpportunities
    .sort((a, b) => b.actionableScore - a.actionableScore)
    .slice(0, 3);
  const biggestPositiveEdge = Math.max(...trustedOpportunities.map((item) => item.edgeScore), 0);
  const biggestNegativeEdge = Math.min(...trustedOpportunities.map((item) => item.edgeScore), 0);
  const updatedAt = newestUpdate(opportunities);
  const topPick = pickTopOpportunity(shortHorizonOpportunities);
  const nextMatch = upcomingMatches[0] ?? null;
  const marketRead = buildMarketRead(shortHorizonOpportunities.length, topPick, nextMatch, locale);
  const suitableForAction = topPick?.executionStatus === "ACTIONABLE_WATCH";
  const fanSummary = buildFanSummary({
    topPick,
    nextMatch,
    gradedCount: shortHorizonOpportunities.length,
    modelWatchlistCount: modelWatchlist.length,
    demoCount: demoSignals.length,
    locale
  });

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
                ? "给世界杯观众看的 Polymarket 机会雷达。"
                : "World Cup Edge Scanner with trusted signal tiers."}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              {locale === "zh"
                ? "先看今日结论，再看具体市场、观察价和风险。不是推荐下注，也不承诺收益。"
                : "Live Polymarket prices, CupEdge fair value model, and clear data-source tiers."}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[620px] xl:grid-cols-3">
              <MetricCard label={locale === "zh" ? "Live Verified" : "Live Verified"} value={String(liveVerified.length)} tone={liveVerified.length ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "模型观察" : "Model Watchlist"} value={String(modelWatchlist.length)} tone={modelWatchlist.length ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "待验证" : "Demo / Verify"} value={String(demoSignals.length)} tone={demoSignals.length ? "neutral" : "positive"} />
              <MetricCard label={locale === "zh" ? "近期 A/B 信号" : "Near-term A/B"} value={String(shortHorizonOpportunities.length)} tone={shortHorizonOpportunities.length ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "适合行动" : "Action Fit"} value={suitableForAction ? (locale === "zh" ? "观察执行" : "Watch") : (locale === "zh" ? "等待" : "Wait")} tone={suitableForAction ? "positive" : "neutral"} />
              <MetricCard label={locale === "zh" ? "追高风险" : "Overheated Favorites"} value={String(overheated.length)} tone={overheated.length ? "negative" : "neutral"} />
            </div>
          </div>
          <FanReadout summary={fanSummary} locale={locale} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard label={locale === "zh" ? "最大价值 Edge" : "Max Value Edge"} value={signedPercent(biggestPositiveEdge)} tone={biggestPositiveEdge >= 0.1 ? "positive" : "neutral"} />
            <MetricCard label={locale === "zh" ? "最低价值 Edge" : "Lowest Value Edge"} value={signedPercent(biggestNegativeEdge)} tone={biggestNegativeEdge <= -0.05 ? "negative" : "neutral"} />
            <MetricCard label={locale === "zh" ? "最后更新" : "Last Updated"} value={updatedAt} />
          </div>
        </section>

        <section className="mb-6 grid gap-3 border-b border-line pb-6 md:grid-cols-3">
          <ReaderStep
            icon="eye"
            title={locale === "zh" ? "1. 先看今日结论" : "1. Read the call"}
            body={locale === "zh" ? "没有 A/B 级信号时，就把页面当作观赛雷达，不要硬找机会。" : "If there are no A/B signals, treat the page as a watch radar, not an action list."}
          />
          <ReaderStep
            icon="radar"
            title={locale === "zh" ? "2. 再看具体市场" : "2. Check the market"}
            body={locale === "zh" ? "重点看市场名称、YES/NO 方向、当前价格和模型概率是否差得足够大。" : "Look at the market, YES/NO side, current price, and fair probability gap."}
          />
          <ReaderStep
            icon="shield"
            title={locale === "zh" ? "3. 最后看风险标签" : "3. Check the risk"}
            body={locale === "zh" ? "待验证、低流动性、未建模的信号，只适合学习和跟踪。" : "Demo, thin, or unmodeled signals are for learning and monitoring only."}
          />
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
                {locale === "zh" ? "暂无 A/B 级可观察机会。" : "No A/B grade actionable watch opportunities right now."}
              </div>
            )}
          </div>
        </section>

        {longTermWatchlist.length ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
                {locale === "zh" ? "Long-term Futures Watchlist / 长期观察" : "Long-term Futures Watchlist"}
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

        <div className="grid gap-6 lg:grid-cols-2">
          <SignalPanel
            title={locale === "zh" ? "Avoid Chasing / 可能被市场追高的热门" : "Avoid Chasing / Overheated Favorites"}
            icon="hot"
            items={overheated.slice(0, 3)}
            locale={locale}
            empty={locale === "zh" ? "暂无明显过热热门。" : "No clear overheated favorites."}
          />
          <SignalPanel
            title={locale === "zh" ? "Basket / Arbitrage Monitor" : "Basket / Arbitrage Monitor"}
            icon="basket"
            items={basketSignals.slice(0, 3)}
            locale={locale}
            empty={locale === "zh" ? "暂无可监控 basket 信号。" : "No basket signals to monitor."}
          />
        </div>
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
        <div className="grid gap-4 lg:grid-cols-3">
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
  const hasMarketPrices = [match.homeProbability, match.drawProbability, match.awayProbability].some(
    (value) => value !== null && value !== undefined
  );
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
  const fairProbabilityNote =
    locale === "zh"
      ? "公允概率由球队基础强度、当前估值模型和 LLM 小幅修正合成；若未匹配到 Polymarket 盘口，只展示公允概率，不计算真实 Edge。"
      : "Fair probability combines team strength, the valuation model, and a small LLM adjustment. Without a matched Polymarket market, no live edge is calculated.";

  return (
    <article className="rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">{time}</p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-100">
            {match.homeTeam} vs {match.awayTeam}
          </h3>
          {match.marketSourceUrl ? (
            <a
              href={match.marketSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs text-zinc-500 hover:text-zinc-200"
            >
              {hasMarketPrices ? "Polymarket" : locale === "zh" ? "CCTV 官方赛程" : "Official schedule"}
            </a>
          ) : null}
        </div>
        <div className="rounded border border-line bg-zinc-950 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-600">
            {locale === "zh" ? "LLM 修正" : "LLM Adjustment"}
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
            {signedPercent(match.llmAdjustment)}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
          <span>{locale === "zh" ? "结果" : "Outcome"}</span>
          <span>{locale === "zh" ? "市场" : "Market"}</span>
          <span>{locale === "zh" ? "公允" : "Fair"}</span>
          <span>Edge</span>
        </div>
        {marketRows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm">
            <span className="truncate text-zinc-300">{row.label}</span>
            <span className="font-mono text-zinc-500">{formatOptionalPercent(row.market, locale)}</span>
            <span className="font-mono text-zinc-100">{percent(row.fair)}</span>
            <span className={`font-mono ${edgeTone(edgeValue(row.fair, row.market))}`}>
              {row.market === null || row.market === undefined ? "--" : signedPercent((row.fair ?? 0) - row.market)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded border border-line bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-500">
        {fairProbabilityNote}
      </p>

      {(match.deepseekResearch || match.gptSummary) ? (
        <div className="mt-5 grid gap-3 text-xs leading-5 lg:grid-cols-2">
          <p className="rounded border border-line bg-zinc-950/40 p-3 text-zinc-400">
            <span className="font-mono text-zinc-300">
              {locale === "zh" ? "DeepSeek 研究" : "DeepSeek Research"}
            </span>
            <br />
            {match.deepseekResearch ?? (locale === "zh" ? "暂无摘要。" : "No summary yet.")}
          </p>
          <p className="rounded border border-line bg-zinc-950/40 p-3 text-zinc-400">
            <span className="font-mono text-zinc-300">
              {locale === "zh" ? "Gemini 总结" : "Gemini Summary"}
            </span>
            <br />
            {match.gptSummary ?? (locale === "zh" ? "暂无总结。" : "No summary yet.")}
          </p>
        </div>
      ) : null}
    </article>
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

function edgeValue(fair: number | null | undefined, market: number | null | undefined) {
  if (fair === null || fair === undefined || market === null || market === undefined) return 0;
  return fair - market;
}

function edgeTone(value: number) {
  if (value >= 0.02) return "text-emerald-300";
  if (value <= -0.02) return "text-red-300";
  return "text-zinc-500";
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
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "设置提醒" : "Set Alert"}
        </Link>
      </div>
    </article>
  );
}

function SignalPanel({
  title,
  icon,
  items,
  locale,
  empty
}: {
  title: string;
  icon: "hot" | "basket";
  items: MarketOpportunity[];
  locale: "zh" | "en";
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {icon === "hot" ? (
          <Flame className="h-4 w-4 text-red-300" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-4 w-4 text-amber-300" aria-hidden="true" />
        )}
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {title}
        </h2>
      </div>
      <div className="space-y-4 p-4">
        {items.length ? (
          items.map((opportunity) => (
            <OpportunityCard
              key={`${opportunity.marketSlug}-${opportunity.outcomeName}-${opportunity.side}`}
              opportunity={opportunity}
              locale={locale}
              compact
            />
          ))
        ) : (
          <p className="text-sm text-zinc-500">{empty}</p>
        )}
      </div>
    </section>
  );
}

function FanReadout({
  summary,
  locale
}: {
  summary: { headline: string; body: string; tone: "positive" | "neutral" | "warning" };
  locale: "zh" | "en";
}) {
  const toneClass =
    summary.tone === "positive"
      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-100"
      : summary.tone === "warning"
        ? "border-amber-500/25 bg-amber-500/5 text-amber-100"
        : "border-line bg-zinc-950/40 text-zinc-200";
  return (
    <div className={`mt-5 rounded-lg border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-current/20 bg-black/20">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide opacity-70">
            {locale === "zh" ? "球迷版解读" : "Fan Readout"}
          </p>
          <h3 className="mt-1 text-base font-semibold">{summary.headline}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 opacity-80">{summary.body}</p>
        </div>
      </div>
    </div>
  );
}

function ReaderStep({
  icon,
  title,
  body
}: {
  icon: "eye" | "radar" | "shield";
  title: string;
  body: string;
}) {
  const Icon = icon === "eye" ? Eye : icon === "radar" ? Radar : ShieldAlert;
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-zinc-950 text-zinc-300">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{body}</p>
        </div>
      </div>
    </div>
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

function buildFanSummary({
  topPick,
  nextMatch,
  gradedCount,
  modelWatchlistCount,
  demoCount,
  locale
}: {
  topPick: MarketOpportunity | null;
  nextMatch: UpcomingMatch | null;
  gradedCount: number;
  modelWatchlistCount: number;
  demoCount: number;
  locale: "zh" | "en";
}) {
  if (nextMatch) {
    return {
      tone: "neutral" as const,
      headline:
        locale === "zh"
          ? `首页先看 ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}`
          : `Start with ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}`,
      body:
        locale === "zh"
          ? "杯赛长期市场会受赛果和赛程路径快速影响，现在只放在观察区；今日结论优先看即将开赛的比赛、公允概率和大模型解释。"
          : "Long-range futures can go stale quickly after match results, so they stay in a watch area. The daily call starts with upcoming matches, fair probabilities, and model research."
    };
  }
  if (topPick && gradedCount > 0) {
    return {
      tone: "positive" as const,
      headline:
        locale === "zh"
          ? `今天可以重点盯 ${topPick.outcomeName} ${topPick.side}`
          : `Watch ${topPick.outcomeName} ${topPick.side} first today`,
      body:
        locale === "zh"
          ? `它不是“必买”，而是当前数据里最值得复核的信号。先看价格是否仍低于观察区间，再看市场深度和数据来源。`
          : `This is not a buy call. It is the strongest signal to review first. Check the entry zone, market depth, and source tier before doing anything.`
    };
  }
  if (modelWatchlistCount > 0) {
    return {
      tone: "warning" as const,
      headline:
        locale === "zh"
          ? "今天更像观察日，不是行动日"
          : "Today is more of a watch day",
      body:
        locale === "zh"
          ? `有 ${modelWatchlistCount} 个模型观察信号，但还没有进入可信 A/B 级。适合中国球迷边看世界杯边建立观察清单，不适合解读成明确机会。`
          : `${modelWatchlistCount} model watch signals exist, but none are trusted A/B grade. Useful for building a watchlist, not for treating as clear opportunities.`
    };
  }
  return {
    tone: "neutral" as const,
    headline:
      locale === "zh"
        ? "今天暂无明确机会，先看比赛和价格变化"
        : "No clear opportunity today",
    body:
      locale === "zh"
        ? `当前 ${demoCount} 个信号仍在待验证或未建模层。页面更适合了解市场怎么定价，而不是寻找行动信号。`
        : `${demoCount} signals are still demo or unmodeled. Use the page to understand market pricing rather than find action signals.`
  };
}
