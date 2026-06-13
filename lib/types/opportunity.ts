import type { Confidence } from "@/lib/types/valuation";

export type MarketType =
  | "WINNER"
  | "GROUP_WINNER"
  | "REACH_R16"
  | "REACH_QF"
  | "REACH_SF"
  | "CONTINENT_WINNER"
  | "OTHER";

export type MarketSide = "YES" | "NO" | "BASKET";
export type PriceSource = "LIVE_POLYMARKET" | "MOCK";
export type VolumeSource = "LIVE_POLYMARKET" | "MOCK";
export type FairValueSource =
  | "BOOKMAKER"
  | "CUPEDGE_V2"
  | "MODEL"
  | "QUANT_MODEL"
  | "RATING_MODEL"
  | "RATING_FALLBACK"
  | "UNMODELED"
  | "MOCK";
export type OpportunityGrade = "A" | "B" | "C" | "D";
export type ExecutionStatus =
  | "ACTIONABLE_WATCH"
  | "WAIT_FOR_BETTER_PRICE"
  | "NEAR_FAIR_VALUE"
  | "TOO_THIN"
  | "MONITOR_ONLY"
  | "OVERHEATED";
export type SignalTrend = "NEW" | "STRENGTHENING" | "FADING" | "STABLE";

export type OpportunitySignalStrength =
  | "strong_edge"
  | "watchlist"
  | "mild_edge"
  | "no_clear_edge"
  | "overheated"
  | "demo_signal"
  | "basket_monitor"
  | "basket_strong"
  | "basket_too_small";

export type MarketOpportunity = {
  id?: string;
  marketSlug: string;
  marketType: MarketType;
  marketTitle: string;
  outcomeName: string;
  side: MarketSide;
  polymarketProbability: number;
  fairProbability: number;
  edgeScore: number;
  actionableScore: number;
  liquidity?: number | null;
  volume24h?: number | null;
  priceSource: PriceSource;
  volumeSource: VolumeSource;
  fairValueSource: FairValueSource;
  dataQuality: Confidence;
  signalStrength: OpportunitySignalStrength;
  signalLabel: string;
  explanation: string;
  riskNote: string;
  sourceUrl?: string | null;
  marketSourceUrl?: string | null;
  sumYesBuyPrices?: number | null;
  basketEdge?: number | null;
  opportunityGrade: OpportunityGrade;
  executionStatus: ExecutionStatus;
  watchBelow?: number | null;
  invalidAt?: number | null;
  signalTrend: SignalTrend;
  conservativeExposureMin?: number | null;
  conservativeExposureMax?: number | null;
  breakEvenProbability: number;
  potentialProfitPer100: number;
  maxLossPer100: number;
  updatedAt: Date | string;
};

export type MarketSummary = {
  marketSlug: string;
  marketType: MarketType;
  marketTitle: string;
  opportunityCount: number;
  bestEdge: number;
  worstEdge: number;
  volume24h: number;
  liquidity: number;
  priceSource: PriceSource;
  volumeSource: VolumeSource;
  fairValueSource: FairValueSource;
  marketSourceUrl?: string | null;
  updatedAt: Date | string;
};
