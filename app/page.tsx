import Link from "next/link";
import { BookOpen, ExternalLink, TrendingUp } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { MatchPricingDeskPanel } from "@/components/match-pricing-desk";
import { TermTooltip } from "@/components/term-tooltip";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { buildMatchPricingDesk } from "@/lib/services/match-pricing";
import { getUpcomingMatches } from "@/lib/services/upcoming-matches";
import type { UpcomingMatch } from "@/lib/types/research";
import { percent, signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const upcomingMatches = await getUpcomingMatches(3);
  const nextMatch = upcomingMatches[0] ?? null;
  const pricingDesk = buildMatchPricingDesk(nextMatch);

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
                ? "单场比赛多玩法公允概率、市场偏差和重要新闻。"
                : "Fair probabilities, market gaps, and important match news across every prop."}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              {locale === "zh"
                ? "首页优先研究下一场比赛：从比分分布推导胜平负、总进球、让球、球队进球，并汇总会影响盘口的 Top 10 新闻。不是推荐下注，也不承诺收益。"
                : "The home page starts with the next match: one score distribution for moneyline, totals, spreads, team totals, plus the top market-moving news."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
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

        {pricingDesk ? (
          <MatchPricingDeskPanel desk={pricingDesk} locale={locale} />
        ) : (
          <div className="mb-7 rounded-lg border border-line bg-panel p-5 text-sm text-zinc-500">
            {locale === "zh"
              ? "暂无可用于首页定价台的即将开赛比赛。"
              : "No upcoming match is available for the home-page pricing desk yet."}
          </div>
        )}

        <UpcomingMatchesSection matches={upcomingMatches} locale={locale} />

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
          {locale === "zh" ? "Polymarket Games + CupEdge 公允概率" : "Polymarket games + CupEdge fair probabilities"}
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
              {hasMarketPrices ? "Polymarket" : "Polymarket Games"}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
          <div className="shrink-0 rounded border border-line bg-zinc-950 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-600">
            <TermTooltip
              term={locale === "zh" ? "LLM 修正" : "LLM Adjustment"}
              align="right"
              description={
                locale === "zh"
                  ? "大模型根据新闻、伤停、赛程等信息对量化概率做的小幅校准。它只用于辅助，不会单独决定结论。"
                  : "A bounded adjustment from news, injuries, schedule, and context. It supports the model but does not decide the result alone."
              }
            />
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
              <TermTooltip
                term={locale === "zh" ? "最佳差值" : "Best Edge"}
                description={
                  locale === "zh"
                    ? "这场比赛胜平负里，公允概率和市场价格差距最大的结果。"
                    : "The moneyline outcome with the largest gap between CupEdge fair probability and market price."
                }
              />
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold ${edgeTone(bestEdgeRow?.edge ?? 0)}`}>
              {signedPercent(bestEdgeRow?.edge ?? 0)}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500">{bestEdgeRow?.label}</div>
          </div>
          <div className="rounded border border-line bg-zinc-950/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-600">
              <TermTooltip
                term={locale === "zh" ? "盘口状态" : "Market Status"}
                description={
                  locale === "zh"
                    ? "显示该比赛是否已经匹配到 Polymarket 市场价格；未匹配时只显示模型公允概率。"
                    : "Shows whether CupEdge has matched this match to market prices. If not, only fair probabilities are shown."
                }
              />
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              {hasMarketPrices
                ? locale === "zh" ? "已匹配" : "Matched"
                : locale === "zh" ? "无市场价" : "No market price"}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500">
              {hasMarketPrices
                ? "Polymarket"
                : locale === "zh" ? "等待市场价格" : "Waiting for prices"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
            <span>{locale === "zh" ? "结果" : "Outcome"}</span>
            <span>
              <TermTooltip
                term={locale === "zh" ? "市场" : "Market"}
                align="right"
                description={
                  locale === "zh"
                    ? "当前市场价格，可近似理解为市场给这个结果的概率。"
                    : "Current market price, roughly the market-implied probability."
                }
              />
            </span>
            <span>
              <TermTooltip
                term={locale === "zh" ? "公允" : "Fair"}
                align="right"
                description={
                  locale === "zh"
                    ? "CupEdge 模型估计的合理概率，用来和市场价格比较。"
                    : "CupEdge's estimated fair probability, used as the baseline against market price."
                }
              />
            </span>
            <span>
              <TermTooltip
                term={edgeLabel}
                align="right"
                description={
                  locale === "zh"
                    ? "Edge = 公允概率 - 市场价格。正值通常表示模型认为价格偏低。"
                    : "Edge = fair probability minus market price. Positive usually means the model sees a lower-than-fair price."
                }
              />
            </span>
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

      </div>
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
