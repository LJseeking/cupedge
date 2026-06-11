import type { Locale } from "@/lib/i18n";
import type { MarketOpportunity, MarketType } from "@/lib/types/opportunity";

export type OpportunityTrustTier =
  | "LIVE_VERIFIED"
  | "MODEL_WATCHLIST"
  | "DEMO_NEEDS_VERIFICATION";

const supportedModelMarkets = new Set<MarketType>([
  "WINNER",
  "GROUP_WINNER"
]);

export function getOpportunityTrustTier(opportunity: MarketOpportunity): OpportunityTrustTier {
  const hasLiveMarketData =
    opportunity.priceSource === "LIVE_POLYMARKET" &&
    opportunity.volumeSource === "LIVE_POLYMARKET";
  const hasUsableFairValue =
    opportunity.fairValueSource === "BOOKMAKER" ||
    opportunity.fairValueSource === "MODEL" ||
    opportunity.fairValueSource === "QUANT_MODEL" ||
    opportunity.fairValueSource === "RATING_MODEL";

  if (!hasLiveMarketData || !hasUsableFairValue || opportunity.dataQuality === "low") {
    return "DEMO_NEEDS_VERIFICATION";
  }

  if (opportunity.marketType === "WINNER" || opportunity.fairValueSource === "BOOKMAKER") {
    return "LIVE_VERIFIED";
  }

  if (supportedModelMarkets.has(opportunity.marketType) || opportunity.fairValueSource === "QUANT_MODEL") {
    return "MODEL_WATCHLIST";
  }

  return "DEMO_NEEDS_VERIFICATION";
}

export function isTrustedHomeSignal(opportunity: MarketOpportunity) {
  const tier = getOpportunityTrustTier(opportunity);
  return (
    tier !== "DEMO_NEEDS_VERIFICATION" &&
    (opportunity.opportunityGrade === "A" || opportunity.opportunityGrade === "B") &&
    opportunity.edgeScore >= 0.1 &&
    opportunity.actionableScore >= 55 &&
    opportunity.executionStatus !== "TOO_THIN"
  );
}

export function isTrustedOverheatedSignal(opportunity: MarketOpportunity) {
  const tier = getOpportunityTrustTier(opportunity);
  return tier !== "DEMO_NEEDS_VERIFICATION" && opportunity.edgeScore <= -0.05;
}

export function trustTierText(tier: OpportunityTrustTier, locale: Locale) {
  const labels: Record<OpportunityTrustTier, { zh: string; en: string }> = {
    LIVE_VERIFIED: { zh: "Live Verified", en: "Live Verified" },
    MODEL_WATCHLIST: { zh: "Model Watchlist", en: "Model Watchlist" },
    DEMO_NEEDS_VERIFICATION: { zh: "Demo / 待验证", en: "Demo / Needs Verification" }
  };
  return locale === "zh" ? labels[tier].zh : labels[tier].en;
}

export function trustTierClasses(tier: OpportunityTrustTier) {
  if (tier === "LIVE_VERIFIED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (tier === "MODEL_WATCHLIST") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-zinc-600 bg-zinc-900 text-zinc-300";
}
