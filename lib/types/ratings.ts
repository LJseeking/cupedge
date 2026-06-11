export type RatingSource = "ELO" | "SPI" | "SEED_FALLBACK";

export type TeamRatingInput = {
  slug: string;
  teamName: string;
  source: RatingSource;
  rating: number;
  normalizedStrength: number;
  rawJson?: unknown;
};

export type TeamStrength = {
  slug: string;
  teamName: string;
  eloRating?: number;
  spiRating?: number;
  ratingStrength: number;
  source: "ELO_SPI" | "ELO" | "SPI" | "SEED_FALLBACK";
};
