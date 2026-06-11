export type ProjectionSource = "QUANT_SIMULATION";

export type ProjectionStrengthSource =
  | "ELO_SPI"
  | "ELO"
  | "SPI"
  | "SEED_FALLBACK"
  | "MIXED";

export type TeamTournamentProjection = {
  slug: string;
  teamName: string;
  source: ProjectionSource;
  strengthSource: ProjectionStrengthSource;
  simulations: number;
  groupWinProbability: number;
  reachR32Probability: number;
  reachR16Probability: number;
  reachQfProbability: number;
  reachSfProbability: number;
  reachFinalProbability: number;
  winTournamentProbability: number;
  rawJson?: unknown;
  updatedAt?: Date | string;
};
