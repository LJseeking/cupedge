export type ResearchScopeType = "TEAM" | "MARKET" | "OPPORTUNITY" | "MATCH";

export type ResearchInsight = {
  id?: string;
  scopeType: ResearchScopeType;
  scopeKey: string;
  teamSlug?: string | null;
  marketSlug?: string | null;
  opportunityId?: string | null;
  matchSlug?: string | null;
  deepseekResearch?: string | null;
  gptSummary?: string | null;
  llmAdjustment: number;
  researchSources?: string | null;
  confidence?: string | null;
  modelCount: number;
  capturedAt: Date | string;
  updatedAt: Date | string;
};

export type UpcomingMatch = {
  id?: string;
  matchSlug: string;
  marketSlug?: string | null;
  marketTitle: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug?: string | null;
  awayTeamSlug?: string | null;
  startTime?: Date | string | null;
  homeProbability?: number | null;
  drawProbability?: number | null;
  awayProbability?: number | null;
  fairHomeProbability?: number | null;
  fairDrawProbability?: number | null;
  fairAwayProbability?: number | null;
  llmAdjustment: number;
  deepseekResearch?: string | null;
  gptSummary?: string | null;
  researchSources?: string | null;
  marketSourceUrl?: string | null;
  updatedAt: Date | string;
};

export type MatchResult = {
  id?: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeScore: number;
  awayScore: number;
  playedAt?: Date | string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceSummary?: string | null;
  confidence: string;
  rawJson?: string | null;
  capturedAt: Date | string;
  updatedAt: Date | string;
};
