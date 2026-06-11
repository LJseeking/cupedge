import type { BookmakerTeamProbability } from "@/lib/types/valuation";

export type OddsProviderKey = "the-odds-api" | "odds-api-io" | "api-football" | "sportmonks";

export type OddsProviderAdapter = {
  key: OddsProviderKey;
  label: string;
  fetchWorldCupWinnerOdds?: () => Promise<BookmakerTeamProbability[]>;
};

export const ODDS_PROVIDER_ADAPTERS: OddsProviderAdapter[] = [
  {
    key: "the-odds-api",
    label: "The Odds API"
  },
  {
    key: "odds-api-io",
    label: "odds-api.io"
  },
  {
    key: "api-football",
    label: "API-Football"
  },
  {
    key: "sportmonks",
    label: "Sportmonks"
  }
];
