import Link from "next/link";
import { ArrowRight, Bell, Gauge, History, Layers, LockKeyhole } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  getOpportunityTrustTier,
  trustTierClasses,
  trustTierText
} from "@/lib/services/opportunity-trust";
import type { MarketOpportunity } from "@/lib/types/opportunity";
import { cn, percent, signedPercent } from "@/lib/utils";

export function OpportunityCard({
  opportunity,
  locale,
  compact = false
}: {
  opportunity: MarketOpportunity;
  locale: Locale;
  compact?: boolean;
}) {
  const trustTier = getOpportunityTrustTier(opportunity);
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{opportunity.marketTitle}</span>
            <span className="text-zinc-700">/</span>
            <span>{marketTypeText(opportunity.marketType, locale)}</span>
          </div>
          <Link href={`/opportunities/${opportunity.id ?? opportunity.marketSlug}`} className="mt-2 block text-lg font-semibold text-zinc-100 hover:underline">
            {opportunity.outcomeName} {opportunity.side}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex w-fit items-center rounded border border-line bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-300">
            Grade {opportunity.opportunityGrade}
          </span>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded border px-2 py-1 text-xs font-medium",
              signalClasses(opportunity.signalStrength)
            )}
          >
            {executionStatusText(opportunity.executionStatus, locale)}
          </span>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded border px-2 py-1 text-xs font-medium",
              trustTierClasses(trustTier)
            )}
          >
            {trustTierText(trustTier, locale)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric
          label={
            opportunity.priceSource === "LIVE_POLYMARKET"
              ? locale === "zh"
                ? "当前价格"
                : "Price"
              : locale === "zh"
                ? "Mock Price"
                : "Mock Price"
          }
          value={percent(opportunity.polymarketProbability)}
        />
        <Metric label={locale === "zh" ? "模型概率" : "Fair"} value={percent(opportunity.fairProbability)} />
        <Metric
          label={locale === "zh" ? "赔率价值" : "Value Edge"}
          value={signedPercent(opportunity.edgeScore)}
          className={opportunity.edgeScore >= 0 ? "text-emerald-300" : "text-red-300"}
        />
        <Metric label={locale === "zh" ? "关注分" : "Actionable"} value={String(Math.round(opportunity.actionableScore))} />
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-300">
        {localizedExplanation(opportunity, locale)}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {localizedRisk(opportunity, locale)}
      </p>

      <EntryZone opportunity={opportunity} locale={locale} />

      {!compact ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "zh" ? "数据质量" : "Data Quality"}: {dataQualityText(opportunity.dataQuality, locale)}
            </span>
            <span>
              {locale === "zh" ? "来源" : "Source"}: {sourceText(opportunity, locale)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "zh" ? "流动性" : "Liquidity"}: {formatCompactNumber(opportunity.liquidity)}
            </span>
            <Link
              href={`/opportunities/${opportunity.id ?? opportunity.marketSlug}`}
              className="ml-auto inline-flex items-center gap-1 text-zinc-300 transition hover:text-zinc-100"
            >
              {locale === "zh" ? "完整分析" : "Full Analysis"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ProLink icon="alert" label={locale === "zh" ? "设置提醒" : "Set Alert"} />
            <ProLink icon="lock" label={locale === "zh" ? "解锁观察价" : "Unlock Entry Zone"} />
            <ProLink icon="history" label={locale === "zh" ? "查看历史" : "View Signal History"} />
          </div>
        </>
      ) : null}
    </article>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-600">{label}</div>
      <div className={cn("mt-1 font-mono text-base font-semibold text-zinc-100", className)}>
        {value}
      </div>
    </div>
  );
}

export function signalText(signalStrength: MarketOpportunity["signalStrength"], locale: Locale) {
  const zh: Record<MarketOpportunity["signalStrength"], string> = {
    strong_edge: "强信号",
    watchlist: "观察名单",
    mild_edge: "轻微信号",
    no_clear_edge: "无明确信号",
    overheated: "可能过热",
    demo_signal: "待验证",
    basket_monitor: "Basket 监控",
    basket_strong: "强 Basket 信号",
    basket_too_small: "Basket 空间过小"
  };
  const en: Record<MarketOpportunity["signalStrength"], string> = {
    strong_edge: "Strong Edge",
    watchlist: "Watchlist",
    mild_edge: "Mild Edge",
    no_clear_edge: "No Clear Edge",
    overheated: "Overheated",
    demo_signal: "Demo Signal",
    basket_monitor: "Basket Monitor",
    basket_strong: "Strong Basket Signal",
    basket_too_small: "Basket Too Small"
  };
  return locale === "zh" ? zh[signalStrength] : en[signalStrength];
}

export function executionStatusText(status: MarketOpportunity["executionStatus"], locale: Locale) {
  const zh: Record<MarketOpportunity["executionStatus"], string> = {
    ACTIONABLE_WATCH: "可观察执行",
    WAIT_FOR_BETTER_PRICE: "等待更好价格",
    NEAR_FAIR_VALUE: "接近公允",
    TOO_THIN: "流动性不足",
    MONITOR_ONLY: "仅监控",
    OVERHEATED: "过热"
  };
  const en: Record<MarketOpportunity["executionStatus"], string> = {
    ACTIONABLE_WATCH: "Actionable Watch",
    WAIT_FOR_BETTER_PRICE: "Wait for Better Price",
    NEAR_FAIR_VALUE: "Near Fair Value",
    TOO_THIN: "Too Thin",
    MONITOR_ONLY: "Monitor Only",
    OVERHEATED: "Overheated"
  };
  return locale === "zh" ? zh[status] : en[status];
}

export function signalClasses(signalStrength: MarketOpportunity["signalStrength"]) {
  if (signalStrength === "strong_edge" || signalStrength === "basket_strong") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (signalStrength === "watchlist" || signalStrength === "basket_monitor") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (signalStrength === "overheated") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (signalStrength === "demo_signal") {
    return "border-zinc-600 bg-zinc-900 text-zinc-300";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-300";
}

export function marketTypeText(type: MarketOpportunity["marketType"], locale: Locale) {
  const zh: Record<MarketOpportunity["marketType"], string> = {
    WINNER: "冠军",
    GROUP_WINNER: "小组冠军",
    REACH_R16: "进入16强",
    REACH_QF: "进入四分之一决赛",
    REACH_SF: "进入半决赛",
    CONTINENT_WINNER: "洲际冠军",
    OTHER: "其他市场"
  };
  const en: Record<MarketOpportunity["marketType"], string> = {
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

export function dataQualityText(quality: string, locale: Locale) {
  const labels: Record<string, { zh: string; en: string }> = {
    high: { zh: "高", en: "High" },
    medium: { zh: "中", en: "Medium" },
    low: { zh: "低", en: "Low" }
  };
  return locale === "zh" ? labels[quality]?.zh ?? quality : labels[quality]?.en ?? quality;
}

function sourceText(opportunity: MarketOpportunity, locale: Locale) {
  const price =
    opportunity.priceSource === "LIVE_POLYMARKET"
      ? "Polymarket Live"
      : locale === "zh"
        ? "Mock 价格"
        : "Mock Price";
  const fair =
    opportunity.fairValueSource === "BOOKMAKER"
      ? "Bookmaker"
      : opportunity.fairValueSource === "CUPEDGE_V2"
        ? "CupEdge v2"
      : opportunity.fairValueSource === "MODEL"
        ? "CupEdge Model"
        : opportunity.fairValueSource === "QUANT_MODEL"
          ? locale === "zh"
            ? "Quant Simulation Model"
            : "Quant Simulation Model"
        : opportunity.fairValueSource === "RATING_MODEL"
          ? locale === "zh"
            ? "Elo/SPI Rating Model"
            : "Elo/SPI Rating Model"
        : opportunity.fairValueSource === "RATING_FALLBACK"
          ? locale === "zh"
            ? "Seed Rating Fallback"
            : "Seed Rating Fallback"
        : opportunity.fairValueSource === "UNMODELED"
          ? locale === "zh"
            ? "未建模"
            : "Unmodeled"
        : locale === "zh"
          ? "Mock 公允值"
          : "Mock Fair";
  return `${price} / ${fair}`;
}

function localizedExplanation(opportunity: MarketOpportunity, locale: Locale) {
  if (locale !== "zh") return opportunity.explanation;
  const edge = Math.abs(opportunity.edgeScore * 100).toFixed(1);
  const priceLabel = opportunity.priceSource === "LIVE_POLYMARKET" ? "当前价格" : "示例价格";
  if (opportunity.side === "BASKET") {
    return `${opportunity.marketTitle} YES basket 总价约为 ${opportunity.sumYesBuyPrices?.toFixed(
      2
    )}，理论 basket edge 约 +${edge} 个百分点。`;
  }
  if (opportunity.fairValueSource === "UNMODELED") {
    return `${opportunity.outcomeName} ${opportunity.side} 已接入 Polymarket 实时价格，但 CupEdge 暂未为该市场建立公允概率模型，因此不显示 Edge 信号。`;
  }
  const probabilityGap = Math.abs((opportunity.fairProbability - opportunity.polymarketProbability) * 100).toFixed(1);
  return `${opportunity.outcomeName} ${opportunity.side} ${priceLabel}为 ${percent(
    opportunity.polymarketProbability
  )}，公允概率约 ${percent(opportunity.fairProbability)}，概率差为 +${probabilityGap} 个百分点，价值 Edge 约 +${edge}%。该信号值得关注，但不代表确定收益。`;
}

function localizedRisk(opportunity: MarketOpportunity, locale: Locale) {
  if (locale !== "zh") return opportunity.riskNote;
  if (opportunity.side === "BASKET") {
    return "理论套利空间可能被滑点、盘口深度和真实成交价格吞噬。";
  }
  if (opportunity.signalStrength === "overheated") {
    return "热门过热可能持续存在，尤其在叙事或公开关注度较强时。";
  }
  if (["REACH_R16", "REACH_QF", "REACH_SF"].includes(opportunity.marketType)) {
    return "晋级市场需要赛程路径、潜在对手和淘汰赛模拟，CupEdge 暂不展示该类市场的公允概率 Edge，不构成投资、博彩或交易建议。";
  }
  return "信号会受流动性、盘口深度和公允概率估计变化影响，不构成投资、博彩或交易建议。";
}

function EntryZone({ opportunity, locale }: { opportunity: MarketOpportunity; locale: Locale }) {
  if (
    opportunity.fairValueSource === "UNMODELED" ||
    opportunity.signalStrength === "no_clear_edge" ||
    opportunity.signalStrength === "demo_signal"
  ) {
    return (
      <div className="mt-4 rounded border border-line bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-500">
        <div className="mb-1 flex items-center gap-2 text-zinc-400">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          {locale === "zh" ? "观察价暂不开放" : "Entry zone unavailable"}
        </div>
        {locale === "zh"
          ? "该信号仍处于未建模、待验证或无明显 Edge 状态。CupEdge 只展示价格和市场信息，不给观察价或失效价。"
          : "This signal is unmodeled, needs verification, or has no clear edge. CupEdge shows market context only, without watch or invalidation prices."}
      </div>
    );
  }

  if (opportunity.side === "BASKET") {
    return (
      <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-zinc-400">
        <div className="grid gap-2 sm:grid-cols-3">
          <span>
            <span className="text-zinc-500">Theoretical Edge</span>
            <br />
            <span className="font-mono text-amber-200">{percent(opportunity.basketEdge)}</span>
          </span>
          <span>
            <span className="text-zinc-500">Execution Risk</span>
            <br />
            {locale === "zh" ? "滑点 / 深度 / 成交价" : "Slippage / depth / fills"}
          </span>
          <span>
            <span className="text-zinc-500">Not guaranteed arbitrage</span>
            <br />
            {locale === "zh" ? "仅作监控信号" : "Monitor signal only"}
          </span>
        </div>
      </div>
    );
  }

  if (opportunity.executionStatus === "OVERHEATED") {
    return (
      <div className="mt-4 rounded border border-red-500/20 bg-red-500/5 p-3 text-xs leading-5 text-red-100">
        {locale === "zh"
          ? `${opportunity.priceSource === "LIVE_POLYMARKET" ? "当前价格" : "示例价格"}高于公允概率，追高风险较高。`
          : "Current price is above fair value; avoid chasing an overheated signal."}
      </div>
    );
  }

  const watchBelow = opportunity.watchBelow ?? Math.max(opportunity.fairProbability - 0.03, 0);
  const invalidNear = opportunity.invalidAt ?? opportunity.fairProbability;

  return (
    <div className="mt-4 rounded border border-line bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-400">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        {locale === "zh" ? "Pro Entry Zone" : "Pro Entry Zone"}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <span>
          {locale === "zh" ? "观察价" : "Watch below"}:{" "}
          <span className="font-mono text-zinc-200">{percent(watchBelow)}</span>
        </span>
        <span>
          {locale === "zh" ? "失效价" : "Invalid near"}:{" "}
          <span className="font-mono text-zinc-200">{percent(invalidNear)}</span>
        </span>
      </div>
      <p className="mt-1 text-zinc-500">
        {locale === "zh"
          ? `低于 ${percent(watchBelow)} 时仍值得关注，接近 ${percent(invalidNear)} 时信号减弱。`
          : `Still worth watching below ${percent(watchBelow)}; signal weakens near ${percent(invalidNear)}.`}
      </p>
    </div>
  );
}

function ProLink({ icon, label }: { icon: "alert" | "lock" | "history"; label: string }) {
  const Icon = icon === "alert" ? Bell : icon === "lock" ? LockKeyhole : History;
  return (
    <Link
      href="/pricing"
      className="inline-flex items-center justify-center gap-2 rounded border border-line bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}

function formatCompactNumber(value?: number | null) {
  if (!value) return "n/a";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}
