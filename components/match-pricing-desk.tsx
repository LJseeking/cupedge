import { Activity, ExternalLink, Newspaper, Target } from "lucide-react";
import type { ReactNode } from "react";
import { TermTooltip } from "@/components/term-tooltip";
import type { MatchNewsItem, MatchPricingDesk, MatchPricingMarket } from "@/lib/services/match-pricing";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

export function MatchPricingDeskPanel({
  desk,
  locale
}: {
  desk: MatchPricingDesk;
  locale: "zh" | "en";
}) {
  const bestExpression = pickBestExpression(desk.markets);
  const derivativeMarkets = desk.markets.filter((market) => market.group !== "moneyline");

  return (
    <section className="mb-7 border-b border-line pb-7">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {locale === "zh" ? "Match Pricing Desk / 单场定价台" : "Match Pricing Desk"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {desk.match.homeTeam} vs {desk.match.awayTeam}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "从同一个比分分布推导胜平负、总进球、让球、球队进球和双方进球，避免不同玩法的概率互相打架。"
              : "One score distribution powers moneyline, totals, spreads, team totals, and BTTS so the market prices stay coherent."}
          </p>
        </div>
        {desk.match.marketSourceUrl ? (
          <a
            href={desk.match.marketSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {locale === "zh" ? "打开市场来源" : "Open Market Source"}
          </a>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-zinc-950/30 px-4 py-3">
            <div className="inline-flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
                <TermTooltip
                  term={locale === "zh" ? "Fair Probability Surface" : "Fair Probability Surface"}
                  description={
                    locale === "zh"
                      ? "公允概率面：用同一套比分分布给胜平负、总进球、让球等玩法定价，避免各盘口互相矛盾。"
                      : "A coherent set of fair probabilities derived from one score distribution across moneyline, totals, spreads, and props."
                  }
                />
              </h3>
            </div>
            <TermTooltip
              term={<span>xG {desk.homeExpectedGoals.toFixed(2)} - {desk.awayExpectedGoals.toFixed(2)}</span>}
              align="right"
              className="text-xs text-zinc-500"
              description={
                locale === "zh"
                  ? "xG 是预期进球。这里表示模型估计两队平均会进多少球，不是比分预测。"
                  : "xG means expected goals: the model's average goal estimate for each team, not a score prediction."
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "玩法" : "Market"}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "市场" : "Market"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "当前市场可买价格，可近似理解为市场给这个结果的隐含概率。"
                          : "The current market buy price, roughly the market-implied probability."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "公允" : "Fair"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "CupEdge 根据模型和比分分布估计的合理概率。它不是确定结果，只是定价基准。"
                          : "CupEdge's estimated fair probability from the model and score distribution. It is a pricing baseline, not certainty."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term="Edge"
                      align="right"
                      description={
                        locale === "zh"
                          ? "Edge = 公允概率 - 市场价格。正数代表模型认为市场可能低估，负数代表可能高估。"
                          : "Edge = fair probability minus market price. Positive suggests possible underpricing; negative suggests possible overpricing."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "目标买价" : "Target Buy"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "一个更保守的参考买入价，通常低于公允概率，用来给模型误差和滑点留空间。"
                          : "A more conservative reference buy price, usually below fair probability to leave room for model error and slippage."
                      }
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {desk.markets.map((market) => (
                  <MarketRow key={market.key} market={market} locale={locale} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-300" aria-hidden="true" />
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
                <TermTooltip
                  term={locale === "zh" ? "Best Expression" : "Best Expression"}
                  description={
                    locale === "zh"
                      ? "同一个比赛观点可以用不同盘口表达，比如强队胜、让球、大球或球队进球。这里显示当前最值得优先研究的表达方式。"
                      : "The preferred way to express the match view: moneyline, spread, total, or team total can all represent different trades."
                  }
                />
              </h3>
            </div>
            <p className="mt-3 text-xl font-semibold text-zinc-100">
              {locale === "zh" ? bestExpression.labelZh : bestExpression.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {locale === "zh" ? bestExpression.noteZh : bestExpression.note}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniMetric
                label={
                  <TermTooltip
                    term={locale === "zh" ? "总预期进球" : "Total xG"}
                    description={
                      locale === "zh"
                        ? "两队 xG 相加，帮助判断总进球盘的大/小方向。"
                        : "Both teams' expected goals added together, useful for reading totals."
                    }
                  />
                }
                value={desk.totalExpectedGoals.toFixed(2)}
              />
              <MiniMetric
                label={locale === "zh" ? "新闻来源" : "Sources"}
                value={desk.sourceCount ? String(desk.sourceCount) : "0"}
              />
              <MiniMetric
                label={
                  <TermTooltip
                    term={locale === "zh" ? "衍生玩法" : "Props"}
                    description={
                      locale === "zh"
                        ? "由同一场比赛延伸出来的盘口，比如总进球、让球、球队进球和双方进球。"
                        : "Derivative markets from the same match, such as totals, spreads, team totals, and BTTS."
                    }
                  />
                }
                value={String(derivativeMarkets.length)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              <TermTooltip
                term={locale === "zh" ? "Score Distribution" : "Score Distribution"}
                description={
                  locale === "zh"
                    ? "模型认为最可能出现的一组比分及其概率。所有总进球、让球和球队进球概率都从这里推导。"
                    : "The model's most likely scores and probabilities. Totals, spreads, and team totals are derived from this distribution."
                }
              />
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {desk.scoreDistribution.map((score) => (
                <div key={score.score} className="rounded border border-line bg-zinc-950/40 px-3 py-2">
                  <div className="font-mono text-base font-semibold text-zinc-100">{score.score}</div>
                  <div className="mt-1 text-xs text-zinc-500">{percent(score.probability)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-zinc-950/30 px-4 py-3">
          <div className="inline-flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-zinc-300" aria-hidden="true" />
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              <TermTooltip
                term={locale === "zh" ? "Top 10 Important Match News" : "Top 10 Important Match News"}
                description={
                  locale === "zh"
                    ? "只收集可能影响盘口和比分分布的信息，例如首发、伤停、轮换、天气、战意和市场价格变化。"
                    : "A filtered set of match-moving information: lineup, injuries, rotation, weather, motivation, and market-price changes."
                }
              />
            </h3>
          </div>
          <span className="text-xs text-zinc-500">
            {locale === "zh" ? "新闻 + 盘口影响" : "News + market impact"}
          </span>
        </div>
        <div className="divide-y divide-line">
          {desk.news.map((item, index) => (
            <NewsRow key={item.key} item={item} rank={index + 1} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketRow({
  market,
  locale
}: {
  market: MatchPricingMarket;
  locale: "zh" | "en";
}) {
  return (
    <tr className="transition hover:bg-zinc-900/60">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-100">{locale === "zh" ? market.labelZh : market.label}</div>
        <div className="mt-1 max-w-[360px] truncate text-xs text-zinc-500">
          {locale === "zh" ? market.noteZh : market.note}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
        {market.marketProbability === null || market.marketProbability === undefined
          ? locale === "zh" ? "无市场价" : "no market price"
          : percent(market.marketProbability)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-100">
        {percent(market.fairProbability)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${edgeTextClasses(market.edge ?? 0)}`}>
        {market.edge === null || market.edge === undefined ? "—" : signedPercent(market.edge)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-300">
        {percent(market.targetPrice)}
      </td>
    </tr>
  );
}

function NewsRow({
  item,
  rank,
  locale
}: {
  item: MatchNewsItem;
  rank: number;
  locale: "zh" | "en";
}) {
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[44px_minmax(0,1fr)_260px] md:items-start">
      <div className="font-mono text-sm text-zinc-500">#{rank}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium text-zinc-100">{locale === "zh" ? item.titleZh : item.title}</h4>
          <span className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide ${impactClasses(item.impact)}`}>
            {impactText(item.impact, locale)}
          </span>
          <span className="rounded border border-line bg-zinc-950 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
            {confidenceText(item.confidence, locale)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {locale === "zh" ? item.summaryZh : item.summary}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-200"
            >
              {item.source}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <span>{item.source}</span>
          )}
          {item.publishedAt ? <span>{item.publishedAt}</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {item.affectedMarkets.map((market) => (
          <span key={market} className="rounded border border-line bg-zinc-950 px-2 py-1 text-xs text-zinc-400">
            {market}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value
}: {
  label: ReactNode;
  value: string;
}) {
  return (
    <div className="rounded border border-line bg-zinc-950/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function pickBestExpression(markets: MatchPricingMarket[]) {
  const pricedMarkets = markets.filter((market) => typeof market.edge === "number");
  const positiveEdge = pricedMarkets.sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))[0];
  if (positiveEdge && (positiveEdge.edge ?? 0) > 0.015) return positiveEdge;
  return markets.find((market) => market.key === "total-over-3.5") ?? markets[0];
}

function impactClasses(impact: MatchNewsItem["impact"]) {
  if (impact === "positive") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (impact === "negative") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (impact === "mixed") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-line bg-zinc-950 text-zinc-400";
}

function impactText(impact: MatchNewsItem["impact"], locale: "zh" | "en") {
  const labels = {
    positive: locale === "zh" ? "正向" : "positive",
    negative: locale === "zh" ? "负向" : "negative",
    mixed: locale === "zh" ? "混合" : "mixed",
    watch: locale === "zh" ? "观察" : "watch"
  };
  return labels[impact];
}

function confidenceText(confidence: MatchNewsItem["confidence"], locale: "zh" | "en") {
  const labels = {
    high: locale === "zh" ? "高置信" : "high confidence",
    medium: locale === "zh" ? "中置信" : "medium confidence",
    low: locale === "zh" ? "低置信" : "low confidence"
  };
  return labels[confidence];
}
