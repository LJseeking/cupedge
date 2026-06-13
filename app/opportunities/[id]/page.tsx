import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, History, LockKeyhole } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { dataQualityText, executionStatusText, marketTypeText } from "@/components/opportunity-card";
import { ResearchInsightPanel } from "@/components/research-insight-panel";
import { getLocale } from "@/lib/i18n-server";
import { getOpportunityDetail } from "@/lib/services/opportunities";
import { getOpportunityTrustTier, trustTierText } from "@/lib/services/opportunity-trust";
import { getResearchInsightForOpportunity } from "@/lib/services/research-insights";
import type { MarketOpportunity } from "@/lib/types/opportunity";
import { percent, signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const { id } = await params;
  const opportunity = await getOpportunityDetail(id);
  if (!opportunity) notFound();
  const trustTier = getOpportunityTrustTier(opportunity);
  const researchInsight = await getResearchInsightForOpportunity(opportunity);

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "返回机会列表" : "Back to opportunities"}
        </Link>

        <div className="mt-6 border-b border-line pb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
            {marketTypeText(opportunity.marketType, locale)} / {opportunity.marketTitle}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
            {opportunity.outcomeName} {opportunity.side}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "这是概率错配信号分析，不是买卖指令，也不是收益承诺。"
              : "This is signal analysis for potential mispricing, not an instruction to trade and not a return promise."}
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <Metric label={locale === "zh" ? "可信层级" : "Trust Tier"} value={trustTierText(trustTier, locale)} />
          <Metric label="Grade" value={opportunity.opportunityGrade} />
          <Metric label={locale === "zh" ? "执行状态" : "Execution"} value={executionStatusText(opportunity.executionStatus, locale)} />
          <Metric
            label={
              opportunity.priceSource === "LIVE_POLYMARKET"
                ? locale === "zh"
                  ? "当前价格"
                  : "Current Price"
                : "Mock Price"
            }
            value={percent(opportunity.polymarketProbability)}
          />
          <Metric label={locale === "zh" ? "公允概率" : "Fair Probability"} value={percent(opportunity.fairProbability)} />
          <Metric label={locale === "zh" ? "价值 Edge" : "Value Edge"} value={signedPercent(opportunity.edgeScore)} tone={opportunity.edgeScore >= 0 ? "positive" : "negative"} />
          <Metric
            label={locale === "zh" ? "概率差" : "Probability Gap"}
            value={signedPercent(opportunity.fairProbability - opportunity.polymarketProbability)}
            tone={opportunity.fairProbability >= opportunity.polymarketProbability ? "positive" : "negative"}
          />
          <Metric label="Action Score" value={String(Math.round(opportunity.actionableScore))} />
          <Metric label={locale === "zh" ? "观察价" : "Watch Below"} value={percent(opportunity.watchBelow)} />
          <Metric label={locale === "zh" ? "失效价" : "Invalid At"} value={percent(opportunity.invalidAt)} />
          <Metric label={locale === "zh" ? "趋势" : "Signal Trend"} value={opportunity.signalTrend} />
          <Metric label={locale === "zh" ? "数据质量" : "Data Quality"} value={dataQualityText(opportunity.dataQuality, locale)} />
          <Metric label="Price Source" value={opportunity.priceSource} />
          <Metric label="Fair Source" value={opportunity.fairValueSource} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {locale === "zh" ? "为什么值得关注" : "Why This Opportunity"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {localizedExplanation(opportunity, locale)}
            </p>
            <h3 className="mt-5 font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {locale === "zh" ? "主要风险" : "Main Risks"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {localizedRisk(opportunity, locale)}
            </p>
            <AlertFit opportunity={opportunity} locale={locale} />
          </section>

          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {opportunity.priceSource === "LIVE_POLYMARKET" ? "P/L Simulator" : "Demo P/L Simulator"}
            </h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {locale === "zh"
                ? opportunity.priceSource === "LIVE_POLYMARKET"
                  ? "假设观察 100 shares 的结构，用于理解风险回报，不代表行动指令。"
                  : "当前价格为 mock 数据，本模拟仅用于展示结构，不代表真实 Polymarket 盈亏。"
                : opportunity.priceSource === "LIVE_POLYMARKET"
                  ? "Assumes 100 shares for understanding risk/reward structure, not an action instruction."
                  : "Current price is mock data, so this simulator only demonstrates structure and is not real Polymarket P/L."}
            </p>
            <div className="mt-4 grid gap-3">
              <Row label="Cost for 100 shares" value={currency(opportunity.maxLossPer100)} />
              <Row label={`Payout if resolved ${opportunity.side}`} value={currency(100)} />
              <Row label="Potential profit" value={currency(opportunity.potentialProfitPer100)} tone="positive" />
              <Row label="Max loss" value={currency(opportunity.maxLossPer100)} tone="negative" />
              <Row label="Break-even probability" value={percent(opportunity.breakEvenProbability)} />
              <Row label="CupEdge fair probability" value={percent(opportunity.fairProbability)} />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-line bg-panel p-5">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {locale === "zh" ? "保守风险暴露参考" : "Conservative Exposure Reference"}
          </h2>
          {opportunity.conservativeExposureMax && opportunity.conservativeExposureMax > 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {locale === "zh"
                ? `参考风险暴露：账户资金的 ${percent(opportunity.conservativeExposureMin)}-${percent(
                    opportunity.conservativeExposureMax
                  )}。仅用于风险管理参考，不构成行动建议。`
                : `Reference risk exposure: ${percent(opportunity.conservativeExposureMin)}-${percent(
                    opportunity.conservativeExposureMax
                  )} of account capital. This is only for risk management context, not advice.`}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {locale === "zh"
                ? "信号不足，不显示仓位参考。"
                : "Signal is insufficient, so no exposure reference is shown."}
            </p>
          )}
        </section>

        <ResearchInsightPanel insight={researchInsight} locale={locale} />

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <LockedLink icon="alert" label="Set Alert" />
          <LockedLink icon="history" label="Unlock Signal History" />
          <LockedLink icon="lock" label="Unlock Entry Zone" />
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
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-600">{label}</div>
      <div
        className={`mt-2 font-mono text-lg font-semibold ${
          tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`font-mono font-semibold ${
          tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : "text-zinc-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function AlertFit({ opportunity, locale }: { opportunity: MarketOpportunity; locale: "zh" | "en" }) {
  const shouldAlert =
    opportunity.executionStatus === "WAIT_FOR_BETTER_PRICE" ||
    opportunity.executionStatus === "ACTIONABLE_WATCH" ||
    opportunity.executionStatus === "MONITOR_ONLY";
  return (
    <p className="mt-5 rounded border border-line bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-500">
      {locale === "zh"
        ? shouldAlert
          ? "是否设置提醒：适合。该信号依赖价格区间，提醒可用于跟踪是否回到观察价。"
          : "是否设置提醒：优先级较低。当前信号更接近公允或存在过热/流动性问题。"
        : shouldAlert
          ? "Alert fit: suitable. This signal depends on price zone, so alerts can help monitor a move back into watch range."
          : "Alert fit: lower priority. The signal is near fair value, overheated, or has liquidity issues."}
    </p>
  );
}

function LockedLink({ icon, label }: { icon: "alert" | "history" | "lock"; label: string }) {
  const Icon = icon === "alert" ? Bell : icon === "history" ? History : LockKeyhole;
  return (
    <Link
      href="/pricing"
      className="inline-flex items-center justify-center gap-2 rounded border border-line bg-zinc-950 px-3 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function localizedExplanation(opportunity: MarketOpportunity, locale: "zh" | "en") {
  if (locale !== "zh") return opportunity.explanation;
  const priceLabel = opportunity.priceSource === "LIVE_POLYMARKET" ? "当前价格" : "示例价格";
  if (opportunity.executionStatus === "OVERHEATED") {
    return `${opportunity.outcomeName} ${opportunity.side} ${priceLabel}高于公允概率，追高风险较高。`;
  }
  return `${opportunity.outcomeName} ${opportunity.side} ${priceLabel}为 ${percent(
    opportunity.polymarketProbability
  )}，公允概率约 ${percent(opportunity.fairProbability)}，概率差为 ${signedPercent(
    opportunity.fairProbability - opportunity.polymarketProbability
  )}，价值 Edge 为 ${signedPercent(
    opportunity.edgeScore
  )}。`;
}

function localizedRisk(opportunity: MarketOpportunity, locale: "zh" | "en") {
  if (locale !== "zh") return opportunity.riskNote;
  if (opportunity.side === "BASKET") return "Basket 理论空间可能被滑点、盘口深度和真实成交价格吞噬。";
  if (opportunity.executionStatus === "OVERHEATED") {
    return `${opportunity.priceSource === "LIVE_POLYMARKET" ? "当前价格" : "示例价格"}高于公允概率，追高风险较高。`;
  }
  return "主要风险包括流动性不足、价格快速变化、公允概率模型误差和数据源仍处于 Demo/Mock 状态。";
}

function currency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a";
  return `$${value.toFixed(2)}`;
}
