import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { TermTooltip } from "@/components/term-tooltip";
import { getLocale } from "@/lib/i18n-server";
import { getMarketDetail } from "@/lib/services/opportunities";
import type { MarketOpportunity, MarketType } from "@/lib/types/opportunity";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

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
  const outcomes = detail.opportunities;
  const pricedOutcomes = outcomes.filter((outcome) => outcome.priceSource === "LIVE_POLYMARKET");
  const marketSourceUrl = detail.summary.marketSourceUrl ?? outcomes.find((outcome) => outcome.marketSourceUrl)?.marketSourceUrl;

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/markets" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {locale === "zh" ? "返回市场列表" : "Back to markets"}
          </Link>
          {marketSourceUrl ? (
            <a
              href={marketSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded border border-line bg-panel px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Polymarket
            </a>
          ) : null}
        </div>

        <div className="mt-6 border-b border-line pb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
            {marketTypeText(detail.summary.marketType, locale)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {detail.summary.marketTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "这个页面用于检查一个长期世界杯市场下各 outcome 的市场价、公允概率和 Edge。单场比赛的总进球、让球和新闻研究请以首页定价台为主。"
              : "Use this page to inspect outcome prices, fair probabilities, and edge inside a long-range World Cup market. Single-match totals, spreads, and news live on the home-page pricing desk."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric
              label={
                <TermTooltip
                  term={locale === "zh" ? "覆盖项" : "Outcomes"}
                  description={
                    locale === "zh"
                      ? "这个市场中被 CupEdge 展示和比较的结果数量。"
                      : "The number of outcomes shown and compared by CupEdge inside this market."
                  }
                />
              }
              value={String(outcomes.length)}
            />
            <Metric
              label={
                <TermTooltip
                  term={locale === "zh" ? "实时价格" : "Live Prices"}
                  description={
                    locale === "zh"
                      ? "已经匹配到 Polymarket 实时价格的结果数量。"
                      : "The number of outcomes matched to live Polymarket prices."
                  }
                />
              }
              value={String(pricedOutcomes.length)}
            />
            <Metric
              label={
                <TermTooltip
                  term="Best Edge"
                  description={
                    locale === "zh"
                      ? "该市场内最大的正向价格差。"
                      : "The largest positive pricing gap in this market."
                  }
                />
              }
              value={signedPercent(detail.summary.bestEdge)}
              tone="positive"
            />
            <Metric
              label={
                <TermTooltip
                  term="Worst Edge"
                  description={
                    locale === "zh"
                      ? "该市场内最大的负向价格差。"
                      : "The largest negative pricing gap in this market."
                  }
                />
              }
              value={signedPercent(detail.summary.worstEdge)}
              tone="negative"
            />
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line bg-zinc-950/30 px-4 py-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {locale === "zh" ? "Outcome Pricing Surface" : "Outcome Pricing Surface"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "结果" : "Outcome"}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "市场价" : "Market"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "Polymarket 当前可参考价格，可近似理解为市场隐含概率。"
                          : "The current Polymarket reference price, roughly the market-implied probability."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "公允" : "Fair"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "CupEdge 模型估计的合理概率。"
                          : "CupEdge's model-estimated fair probability."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term="Edge"
                      align="right"
                      description={
                        locale === "zh"
                          ? "Edge = 公允概率 - 市场价。正数表示模型认为价格可能偏低。"
                          : "Edge = fair probability minus market price. Positive means the model sees possible underpricing."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "流动性" : "Liquidity"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "盘口深度的近似指标。流动性低时，理论价格差可能很难真实成交。"
                          : "Approximate market depth. When liquidity is low, a theoretical edge may be hard to execute."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <TermTooltip
                      term={locale === "zh" ? "成交量" : "Volume"}
                      align="right"
                      description={
                        locale === "zh"
                          ? "近期实际成交规模。成交量越高，价格一般越有参考意义。"
                          : "Recent traded amount. Higher volume generally makes the price more informative."
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">{locale === "zh" ? "说明" : "Note"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {outcomes.map((outcome) => (
                  <OutcomeRow key={`${outcome.outcomeName}-${outcome.side}`} outcome={outcome} locale={locale} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function OutcomeRow({
  outcome,
  locale
}: {
  outcome: MarketOpportunity;
  locale: "zh" | "en";
}) {
  return (
    <tr className="transition hover:bg-zinc-900/60">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-100">
          {outcome.outcomeName} {outcome.side}
        </div>
        <div className="mt-1 text-xs text-zinc-600">{marketTypeText(outcome.marketType, locale)}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-300">
        {outcome.priceSource === "LIVE_POLYMARKET" ? percent(outcome.polymarketProbability) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-100">
        {percent(outcome.fairProbability)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${edgeTextClasses(outcome.edgeScore)}`}>
        {signedPercent(outcome.edgeScore)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
        {formatCompactNumber(outcome.liquidity)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
        {outcome.volumeSource === "LIVE_POLYMARKET" ? formatCompactNumber(outcome.volume24h) : "—"}
      </td>
      <td className="px-4 py-3 text-zinc-500">
        {outcome.fairValueSource === "UNMODELED"
          ? locale === "zh" ? "仅价格覆盖，未纳入公允模型。" : "Price coverage only, not modeled yet."
          : outcome.fairValueSource === "RATING_FALLBACK"
            ? locale === "zh" ? "使用本地强度兜底，适合低权重参考。" : "Using fallback team strength; read with lower weight."
            : locale === "zh" ? "公允概率来自 CupEdge 模型。" : "Fair probability from the CupEdge model."}
      </td>
    </tr>
  );
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: ReactNode;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded border border-line bg-panel p-3">
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

function formatCompactNumber(value: number | null | undefined) {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
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
