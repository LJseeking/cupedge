export type SnapshotSource = "POLYMARKET" | "BOOKMAKER" | "FAIR";

export type TeamStatus =
  | "undervalued"
  | "slightly_undervalued"
  | "fair"
  | "slightly_overvalued"
  | "overvalued";

export type Confidence = "high" | "medium" | "low";

export type TeamSeed = {
  name: string;
  slug: string;
  countryCode?: string;
  group?: string;
  seedAiProbability: number;
};

export type PolymarketTeamQuote = {
  teamName: string;
  slug: string;
  probability: number;
  bestBid?: number;
  bestAsk?: number;
  midPrice?: number;
  spread?: number;
  liquidity?: number;
  volume?: number;
  rawJson?: unknown;
  updatedAt?: string;
};

export type BookmakerTeamProbability = {
  teamName: string;
  slug: string;
  bookmakerProbability: number;
  bookmakerCount: number;
  medianDecimalOdds?: number;
  rawJson?: unknown;
  odds: BookmakerOddRecord[];
};

export type BookmakerOddRecord = {
  slug: string;
  teamName: string;
  bookmaker: string;
  decimalOdds: number;
  impliedProbability: number;
  normalizedProbability: number;
  rawJson?: unknown;
};

export type ValuationRow = {
  id?: string;
  teamId: string;
  name: string;
  slug: string;
  countryCode?: string | null;
  polymarketProbability: number;
  bookmakerProbability?: number | null;
  aiProbability?: number | null;
  marketConsensusProbability?: number | null;
  quantProbability?: number | null;
  llmAdjustment?: number | null;
  llmAdjustmentReason?: string | null;
  llmModelCount?: number | null;
  deepseekResearch?: string | null;
  gptSummary?: string | null;
  researchSources?: string | null;
  probabilityModelVersion?: string | null;
  fairProbability: number;
  edgeScore: number;
  status: TeamStatus;
  confidence: Confidence;
  summary?: string | null;
  updatedAt: Date | string;
};

export type TeamDetail = ValuationRow & {
  explanations: string[];
};

export type MoveSignal =
  | "became_cheaper"
  | "became_expensive"
  | "new_value_signal"
  | "overheat_signal"
  | "stable";

export type TeamMove = {
  team: string;
  slug: string;
  previousPolymarket: number;
  currentPolymarket: number;
  change: number;
  previousEdge: number;
  currentEdge: number;
  signal: MoveSignal;
};
