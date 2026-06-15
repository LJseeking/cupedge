import type { UpcomingMatch } from "@/lib/types/research";
import { clampProbability } from "@/lib/utils";

export type MatchPricingMarket = {
  key: string;
  group: "moneyline" | "total" | "spread" | "teamTotal" | "bothTeams";
  label: string;
  labelZh: string;
  marketProbability?: number | null;
  fairProbability: number;
  edge?: number | null;
  targetPrice: number;
  note: string;
  noteZh: string;
};

export type MatchNewsItem = {
  key: string;
  title: string;
  titleZh: string;
  impact: "positive" | "negative" | "mixed" | "watch";
  affectedMarkets: string[];
  confidence: "high" | "medium" | "low";
  importance: number;
  summary: string;
  summaryZh: string;
  source: string;
  sourceUrl?: string;
  publishedAt?: string;
};

export type ScoreProbability = {
  score: string;
  probability: number;
};

export type MatchPricingDesk = {
  match: UpcomingMatch;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  totalExpectedGoals: number;
  markets: MatchPricingMarket[];
  news: MatchNewsItem[];
  scoreDistribution: ScoreProbability[];
  sourceCount: number;
};

type ScoreCell = {
  home: number;
  away: number;
  probability: number;
};

const MAX_GOALS = 10;
const TARGET_MARGIN = 0.02;

export function buildMatchPricingDesk(match: UpcomingMatch | null | undefined): MatchPricingDesk | null {
  if (!match) return null;

  const fair = normalizedMatchProbabilities(match);
  const propPrices = new Map((match.propMarketPrices ?? []).map((price) => [price.key, price]));
  const lambdas = fitExpectedGoals(fair.home, fair.draw, fair.away);
  const scoreMatrix = buildScoreMatrix(lambdas.home, lambdas.away);
  const favorite = fair.home >= fair.away ? "home" : "away";
  const favoriteTeam = favorite === "home" ? match.homeTeam : match.awayTeam;
  const underdogTeam = favorite === "home" ? match.awayTeam : match.homeTeam;
  const favoriteExpectedGoals = favorite === "home" ? lambdas.home : lambdas.away;
  const underdogExpectedGoals = favorite === "home" ? lambdas.away : lambdas.home;

  return {
    match,
    homeExpectedGoals: lambdas.home,
    awayExpectedGoals: lambdas.away,
    totalExpectedGoals: lambdas.home + lambdas.away,
    markets: [
      moneylineMarket("home", match.homeTeam, match.homeProbability, fair.home, propPrices),
      moneylineMarket("draw", "Draw", match.drawProbability, fair.draw, propPrices),
      moneylineMarket("away", match.awayTeam, match.awayProbability, fair.away, propPrices),
      totalMarket(scoreMatrix, 3.5, propPrices),
      totalMarket(scoreMatrix, 4.5, propPrices),
      totalMarket(scoreMatrix, 5.5, propPrices),
      spreadMarket(scoreMatrix, favorite, favoriteTeam, 1.5, propPrices),
      spreadMarket(scoreMatrix, favorite, favoriteTeam, 2.5, propPrices),
      teamTotalMarket(scoreMatrix, favorite, favoriteTeam, 2.5, propPrices),
      teamTotalMarket(scoreMatrix, favorite, favoriteTeam, 3.5, propPrices),
      underdogUnderMarket(scoreMatrix, favorite, underdogTeam, 0.5, propPrices),
      bothTeamsMarket(scoreMatrix, propPrices)
    ],
    news: buildMatchNews(match, {
      fair,
      favoriteTeam,
      underdogTeam,
      favoriteExpectedGoals,
      underdogExpectedGoals,
      totalExpectedGoals: lambdas.home + lambdas.away,
      sourceCount: countResearchSources(match.researchSources)
    }),
    scoreDistribution: topScores(scoreMatrix, 8),
    sourceCount: countResearchSources(match.researchSources)
  };
}

function normalizedMatchProbabilities(match: UpcomingMatch) {
  const home = firstProbability(match.fairHomeProbability, match.homeProbability, 1 / 3);
  const draw = firstProbability(match.fairDrawProbability, match.drawProbability, 1 / 3);
  const away = firstProbability(match.fairAwayProbability, match.awayProbability, 1 / 3);
  const total = home + draw + away;
  if (total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return {
    home: home / total,
    draw: draw / total,
    away: away / total
  };
}

function firstProbability(...values: Array<number | null | undefined>) {
  const value = values.find((item) => typeof item === "number" && Number.isFinite(item) && item >= 0);
  return clampProbability(value ?? 0);
}

function fitExpectedGoals(homeWin: number, draw: number, awayWin: number) {
  const noDrawFavorite = Math.max(homeWin, awayWin) / Math.max(0.001, homeWin + awayWin);
  const mismatch = Math.abs(noDrawFavorite - 0.5);
  const totalPrior = 2.45 + mismatch * 2.25 + Math.max(0, 0.22 - draw) * 2.2;
  let best = { home: totalPrior / 2, away: totalPrior / 2, error: Number.POSITIVE_INFINITY };

  for (let home = 0.15; home <= 5.8; home += 0.05) {
    for (let away = 0.15; away <= 4.4; away += 0.05) {
      const matrix = buildScoreMatrix(home, away);
      const implied = matrix.reduce(
        (sum, cell) => ({
          home: sum.home + (cell.home > cell.away ? cell.probability : 0),
          draw: sum.draw + (cell.home === cell.away ? cell.probability : 0),
          away: sum.away + (cell.home < cell.away ? cell.probability : 0)
        }),
        { home: 0, draw: 0, away: 0 }
      );
      const total = home + away;
      const error =
        Math.pow(implied.home - homeWin, 2) * 2.2 +
        Math.pow(implied.draw - draw, 2) * 1.7 +
        Math.pow(implied.away - awayWin, 2) * 2.2 +
        Math.pow(total - totalPrior, 2) * 0.025;
      if (error < best.error) best = { home, away, error };
    }
  }

  return { home: round(best.home, 2), away: round(best.away, 2) };
}

function buildScoreMatrix(homeLambda: number, awayLambda: number): ScoreCell[] {
  const homeDistribution = poissonDistribution(homeLambda, MAX_GOALS);
  const awayDistribution = poissonDistribution(awayLambda, MAX_GOALS);
  const cells: ScoreCell[] = [];
  for (let home = 0; home < homeDistribution.length; home += 1) {
    for (let away = 0; away < awayDistribution.length; away += 1) {
      cells.push({
        home,
        away,
        probability: homeDistribution[home] * awayDistribution[away]
      });
    }
  }
  return normalizeScoreMatrix(cells);
}

function poissonDistribution(lambda: number, maxGoals: number) {
  const values: number[] = [];
  let sum = 0;
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    const probability = Math.exp(-lambda) * Math.pow(lambda, goals) / factorial(goals);
    values.push(probability);
    sum += probability;
  }
  values[maxGoals] += Math.max(0, 1 - sum);
  return values;
}

function factorial(value: number) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function normalizeScoreMatrix(cells: ScoreCell[]) {
  const total = cells.reduce((sum, cell) => sum + cell.probability, 0);
  if (total <= 0) return cells;
  return cells.map((cell) => ({ ...cell, probability: cell.probability / total }));
}

function moneylineMarket(
  key: "home" | "draw" | "away",
  label: string,
  marketProbability: number | null | undefined,
  fairProbability: number,
  propPrices: Map<string, { marketProbability: number }>
): MatchPricingMarket {
  const price = propPrices.get(`moneyline-${key}`)?.marketProbability ?? marketProbability;
  return {
    key: `moneyline-${key}`,
    group: "moneyline",
    label,
    labelZh: key === "draw" ? "平局" : label,
    marketProbability: price,
    fairProbability,
    edge: price === null || price === undefined ? null : fairProbability - price,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "Moneyline anchor used to fit the score distribution.",
    noteZh: "胜平负锚点，用来反推比分分布。"
  };
}

function totalMarket(matrix: ScoreCell[], line: number, propPrices: Map<string, { marketProbability: number }>): MatchPricingMarket {
  const fairProbability = probabilityWhere(matrix, (cell) => cell.home + cell.away > line);
  const marketProbability = propPrices.get(`total-over-${line}`)?.marketProbability ?? null;
  return {
    key: `total-over-${line}`,
    group: "total",
    label: `Over ${line}`,
    labelZh: `总进球大 ${line}`,
    marketProbability,
    fairProbability,
    edge: marketProbability === null ? null : fairProbability - marketProbability,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "Derived from one score matrix, so totals stay internally consistent.",
    noteZh: "由同一比分矩阵推导，保证各档总进球概率一致。"
  };
}

function spreadMarket(
  matrix: ScoreCell[],
  favorite: "home" | "away",
  favoriteTeam: string,
  line: number,
  propPrices: Map<string, { marketProbability: number }>
): MatchPricingMarket {
  const key = `spread-${favorite}-${line}`;
  const fairProbability = probabilityWhere(matrix, (cell) => {
    const margin = favorite === "home" ? cell.home - cell.away : cell.away - cell.home;
    return margin > line;
  });
  const marketProbability = propPrices.get(key)?.marketProbability ?? null;
  return {
    key,
    group: "spread",
    label: `${favoriteTeam} -${line}`,
    labelZh: `${favoriteTeam} -${line}`,
    marketProbability,
    fairProbability,
    edge: marketProbability === null ? null : fairProbability - marketProbability,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "This is the cleaner test for blowout belief than moneyline.",
    noteZh: "比胜负更能检验“大胜”判断。"
  };
}

function teamTotalMarket(
  matrix: ScoreCell[],
  favorite: "home" | "away",
  favoriteTeam: string,
  line: number,
  propPrices: Map<string, { marketProbability: number }>
): MatchPricingMarket {
  const key = `team-total-${favorite}-over-${line}`;
  const fairProbability = probabilityWhere(matrix, (cell) => {
    const goals = favorite === "home" ? cell.home : cell.away;
    return goals > line;
  });
  const marketProbability = propPrices.get(key)?.marketProbability ?? null;
  return {
    key,
    group: "teamTotal",
    label: `${favoriteTeam} goals over ${line}`,
    labelZh: `${favoriteTeam} 进球大 ${line}`,
    marketProbability,
    fairProbability,
    edge: marketProbability === null ? null : fairProbability - marketProbability,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "Separates favorite scoring power from underdog contribution.",
    noteZh: "把强队进球能力和弱队是否进球拆开看。"
  };
}

function underdogUnderMarket(
  matrix: ScoreCell[],
  favorite: "home" | "away",
  underdogTeam: string,
  line: number,
  propPrices: Map<string, { marketProbability: number }>
): MatchPricingMarket {
  const key = `underdog-under-${line}`;
  const fairProbability = probabilityWhere(matrix, (cell) => {
    const goals = favorite === "home" ? cell.away : cell.home;
    return goals < line;
  });
  const marketProbability = propPrices.get(key)?.marketProbability ?? null;
  return {
    key,
    group: "teamTotal",
    label: `${underdogTeam} goals under ${line}`,
    labelZh: `${underdogTeam} 进球小 ${line}`,
    marketProbability,
    fairProbability,
    edge: marketProbability === null ? null : fairProbability - marketProbability,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "Clean-sheet pricing is often where totals and spreads disagree.",
    noteZh: "零封价格经常能暴露总进球和让球之间的不一致。"
  };
}

function bothTeamsMarket(matrix: ScoreCell[], propPrices: Map<string, { marketProbability: number }>): MatchPricingMarket {
  const fairProbability = probabilityWhere(matrix, (cell) => cell.home > 0 && cell.away > 0);
  const marketProbability = propPrices.get("both-teams-score-yes")?.marketProbability ?? null;
  return {
    key: "both-teams-score-yes",
    group: "bothTeams",
    label: "Both teams to score",
    labelZh: "双方均进球",
    marketProbability,
    fairProbability,
    edge: marketProbability === null ? null : fairProbability - marketProbability,
    targetPrice: Math.max(0, fairProbability - TARGET_MARGIN),
    note: "Checks whether high total prices need underdog goals to work.",
    noteZh: "检查大球价格是否依赖弱队也进球。"
  };
}

function probabilityWhere(matrix: ScoreCell[], predicate: (cell: ScoreCell) => boolean) {
  return clampProbability(matrix.reduce((sum, cell) => sum + (predicate(cell) ? cell.probability : 0), 0));
}

function topScores(matrix: ScoreCell[], limit: number) {
  return [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit)
    .map((cell) => ({
      score: `${cell.home}-${cell.away}`,
      probability: cell.probability
    }));
}

function buildMatchNews(
  match: UpcomingMatch,
  context: {
    fair: { home: number; draw: number; away: number };
    favoriteTeam: string;
    underdogTeam: string;
    favoriteExpectedGoals: number;
    underdogExpectedGoals: number;
    totalExpectedGoals: number;
    sourceCount: number;
  }
): MatchNewsItem[] {
  const fixtureKey = `${match.homeTeam} ${match.awayTeam}`.toLowerCase();
  if (fixtureKey.includes("spain") && (fixtureKey.includes("cape verde") || fixtureKey.includes("cabo verde"))) {
    return buildSpainCapeVerdeNews(context);
  }

  const researchText = [match.deepseekResearch, match.gptSummary].filter(Boolean).join("\n").toLowerCase();
  const hasMarket = [match.homeProbability, match.drawProbability, match.awayProbability].every(
    (value) => value !== null && value !== undefined
  );
  const favoriteWin = Math.max(context.fair.home, context.fair.away);
  const drawSuppression = context.fair.draw < 0.16;

  const news: MatchNewsItem[] = [
    {
      key: "score-distribution",
      title: "Score matrix prices every market from one fair distribution",
      titleZh: "同一比分矩阵统一定价所有玩法",
      impact: "positive",
      affectedMarkets: ["Moneyline", "Totals", "Spread", "Team totals"],
      confidence: "high",
      importance: 96,
      summary: `${context.favoriteTeam} is fitted at ${round(context.favoriteExpectedGoals, 2)} expected goals, ${context.underdogTeam} at ${round(context.underdogExpectedGoals, 2)}.`,
      summaryZh: `${context.favoriteTeam} 预期进球 ${round(context.favoriteExpectedGoals, 2)}，${context.underdogTeam} 预期进球 ${round(context.underdogExpectedGoals, 2)}。`,
      source: "CupEdge model",
      publishedAt: "model"
    },
    {
      key: "market-anchor",
      title: hasMarket ? "Polymarket moneyline is matched" : "Derivative prices need live orderbook connection",
      titleZh: hasMarket ? "已匹配 Polymarket 胜平负锚点" : "衍生盘口仍需接入实时订单簿",
      impact: hasMarket ? "watch" : "mixed",
      affectedMarkets: ["Market probability", "Edge"],
      confidence: hasMarket ? "high" : "medium",
      importance: hasMarket ? 90 : 86,
      summary: hasMarket
        ? "Moneyline prices can be compared now; totals and props show fair target prices until those orderbooks are captured."
        : "The desk can show fair probabilities today, but edge becomes actionable only after each prop market price is captured.",
      summaryZh: hasMarket
        ? "胜平负已经可以比较；总进球和球队进球先显示公允目标价，等待订单簿价格接入。"
        : "现在可以显示公允概率；每个细分盘口接入价格后，Edge 才能进入行动层。",
      source: "Polymarket/CupEdge",
      sourceUrl: "https://polymarket.com/zh/sports/world-cup/fifwc-esp-cvi-2026-06-15",
      publishedAt: "live market"
    },
    {
      key: "blowout-path",
      title: favoriteWin >= 0.72 ? "Favorite win and favorite scoring are not the same trade" : "No clear blowout favorite from fair probabilities",
      titleZh: favoriteWin >= 0.72 ? "强队赢球和强队打穿不是同一笔交易" : "公允概率暂未显示明显大胜结构",
      impact: favoriteWin >= 0.72 ? "watch" : "mixed",
      affectedMarkets: ["Favorite -2.5", "Over 4.5", "Over 5.5"],
      confidence: "high",
      importance: 84,
      summary: favoriteWin >= 0.72
        ? "A heavy favorite can still land on 3-0 or 4-0, which pays very differently across the over ladder."
        : "The model does not currently justify treating high totals as an automatic extension of the match winner.",
      summaryZh: favoriteWin >= 0.72
        ? "强队大热仍可能落在 3-0 或 4-0，不同大球阶梯的收益差异很大。"
        : "模型暂不支持把胜负判断直接外推成高阶大球判断。",
      source: "CupEdge model",
      publishedAt: "model"
    },
    {
      key: "lineup-rotation",
      title: "Lineup and rotation are the largest pre-match news risk",
      titleZh: "首发和轮换是赛前最大新闻风险",
      impact: keywordHit(researchText, ["lineup", "starting", "xi", "rotation", "rest", "首发", "轮换"]) ? "negative" : "watch",
      affectedMarkets: ["Over 4.5", "Over 5.5", "Favorite team total"],
      confidence: signalConfidence(researchText, ["lineup", "starting", "xi", "rotation", "rest", "首发", "轮换"], context.sourceCount),
      importance: 80,
      summary: "If attacking starters are rested, the favorite can still win while the ceiling markets lose value.",
      summaryZh: "如果进攻主力轮休，强队仍可能赢球，但高阶大球和强队进球数会降温。",
      source: "Match research",
      publishedAt: "latest"
    },
    {
      key: "injuries-suspensions",
      title: "Injuries and suspensions can move totals more than moneyline",
      titleZh: "伤停和停赛对总进球的影响可能大于胜负",
      impact: keywordHit(researchText, ["injury", "injured", "suspension", "suspended", "伤", "停赛"]) ? "mixed" : "watch",
      affectedMarkets: ["Team totals", "BTTS", "Spread"],
      confidence: signalConfidence(researchText, ["injury", "injured", "suspension", "suspended", "伤", "停赛"], context.sourceCount),
      importance: 76,
      summary: "Forward absences cap overs; goalkeeper or center-back absences can raise the opponent team total.",
      summaryZh: "前锋缺阵会压低大球上限；门将或中卫缺阵可能抬高对手球队进球。",
      source: "Match research",
      publishedAt: "latest"
    },
    {
      key: "tactical-matchup",
      title: "Low block versus early goal changes the whole over ladder",
      titleZh: "低位防守与早球会改变整条大球曲线",
      impact: "mixed",
      affectedMarkets: ["Over 3.5", "Over 4.5", "Spread"],
      confidence: signalConfidence(researchText, ["tactic", "press", "low block", "defend", "战术", "防守", "压迫"], context.sourceCount),
      importance: 72,
      summary: "A deep underdog can suppress shot quality, but an early favorite goal opens the match state.",
      summaryZh: "弱队深度防守会压低射门质量，但强队早进球会迅速打开比赛状态。",
      source: "Match research",
      publishedAt: "latest"
    },
    {
      key: "motivation",
      title: "Motivation matters most when goal difference is valuable",
      titleZh: "当净胜球有价值时，战意对大胜盘口最重要",
      impact: "watch",
      affectedMarkets: ["Favorite -3.5", "Over 5.5", "Correct score"],
      confidence: signalConfidence(researchText, ["motivation", "goal difference", "must win", "qualified", "净胜球", "出线", "战意"], context.sourceCount),
      importance: 68,
      summary: "If the favorite needs goal difference, late-game attacking intensity should be priced higher.",
      summaryZh: "如果强队需要净胜球，领先后的继续进攻强度应被上调。",
      source: "Match research",
      publishedAt: "latest"
    },
    {
      key: "schedule-travel",
      title: "Rest, travel, and heat affect late scoring",
      titleZh: "休息、旅途和高温会影响后段进球",
      impact: "watch",
      affectedMarkets: ["Second-half goals", "Over 4.5", "Over 5.5"],
      confidence: signalConfidence(researchText, ["travel", "rest", "fatigue", "heat", "weather", "pitch", "旅途", "休息", "天气", "场地"], context.sourceCount),
      importance: 64,
      summary: "Fatigue can create late mistakes, while heat or poor pitch conditions can slow tempo.",
      summaryZh: "体能下降会制造后段失误，高温或场地问题则可能降低节奏。",
      source: "Match research",
      publishedAt: "latest"
    },
    {
      key: "btts-dependency",
      title: "High totals may depend on whether the underdog scores",
      titleZh: "高阶大球可能依赖弱队是否进球",
      impact: context.underdogExpectedGoals >= 0.75 ? "positive" : "negative",
      affectedMarkets: ["BTTS", "Over 4.5", "Over 5.5"],
      confidence: "medium",
      importance: 60,
      summary: `${context.underdogTeam} is fitted at ${round(context.underdogExpectedGoals, 2)} expected goals, so compare overs against BTTS and clean-sheet prices.`,
      summaryZh: `${context.underdogTeam} 预期进球 ${round(context.underdogExpectedGoals, 2)}，需要把大球、双方进球和零封价格一起看。`,
      source: "CupEdge model",
      publishedAt: "model"
    },
    {
      key: "draw-compression",
      title: drawSuppression ? "Low draw probability pushes value into spreads and totals" : "Draw probability still absorbs some favorite edge",
      titleZh: drawSuppression ? "低平局概率会把价值推向让球和大球" : "平局概率仍会吸收一部分强队优势",
      impact: drawSuppression ? "positive" : "watch",
      affectedMarkets: ["Favorite spread", "Totals", "Moneyline"],
      confidence: "high",
      importance: 56,
      summary: drawSuppression
        ? "The distribution is less draw-heavy, making margin and total-goal markets more sensitive."
        : "A meaningful draw pocket means moneyline certainty should not be confused with margin certainty.",
      summaryZh: drawSuppression
        ? "分布不偏平局，让球和总进球盘口对比分变化更敏感。"
        : "仍有明显平局区间，胜负确定性不能等同于净胜球确定性。",
      source: "CupEdge model",
      publishedAt: "model"
    }
  ];

  return news.sort((a, b) => b.importance - a.importance).slice(0, 10);
}

function buildSpainCapeVerdeNews(context: {
  fair: { home: number; draw: number; away: number };
  favoriteTeam: string;
  underdogTeam: string;
  favoriteExpectedGoals: number;
  underdogExpectedGoals: number;
  totalExpectedGoals: number;
}) {
  return [
    {
      key: "yamal-williams-bench",
      title: "Lamine Yamal and Nico Williams available, but expected to start on bench",
      titleZh: "Yamal 与 Nico Williams 可出场，但预计替补开始",
      impact: "negative",
      affectedMarkets: ["Over 4.5", "Over 5.5", "Spain team total"],
      confidence: "high",
      importance: 98,
      summary: "Spain's ceiling still exists, but two elite wide attackers not starting lowers the early blowout path.",
      summaryZh: "西班牙仍有大胜上限，但两名边路爆点不首发，会压低开局阶段快速打穿高阶大球的路径。",
      source: "Standard / Yahoo Sports",
      sourceUrl: "https://sports.yahoo.com/articles/spain-xi-vs-cape-verde-215539122.html",
      publishedAt: "Jun 15"
    },
    {
      key: "no-injury-concerns",
      title: "Both teams report no major injury concerns",
      titleZh: "双方赛前没有主要伤病问题",
      impact: "positive",
      affectedMarkets: ["Moneyline", "Spread", "Totals"],
      confidence: "high",
      importance: 94,
      summary: "No late injury downgrade means CupEdge should not haircut Spain's baseline strength because of availability.",
      summaryZh: "没有临场伤病降级，CupEdge 不应因为可用性问题下调西班牙基础实力。",
      source: "Barca Blaugranes",
      sourceUrl: "https://www.barcablaugranes.com/world-cup-2026/123471/spain-cape-verde-world-cup-2026-team-news-match-preview-lineups-prediction",
      publishedAt: "Jun 15"
    },
    {
      key: "pedri-cubarsi-ferran-start",
      title: "Pedri, Pau Cubarsi and Ferran Torres expected to start for Spain",
      titleZh: "Pedri、Pau Cubarsi、Ferran Torres 预计首发",
      impact: "positive",
      affectedMarkets: ["Spain -2.5", "Spain team total", "Over 3.5"],
      confidence: "medium",
      importance: 90,
      summary: "Spain still projects with midfield control and enough final-third quality even if Yamal and Williams are held back.",
      summaryZh: "即使 Yamal 和 Williams 先替补，西班牙仍有中场控制和前场质量支撑让球与 3.5 大球。",
      source: "Barca Blaugranes",
      sourceUrl: "https://www.barcablaugranes.com/world-cup-2026/123471/spain-cape-verde-world-cup-2026-team-news-match-preview-lineups-prediction",
      publishedAt: "Jun 15"
    },
    {
      key: "spain-euro-champion-core",
      title: "Spain arrive as European champions with continuity and strong squad belief",
      titleZh: "西班牙以欧洲冠军身份出战，阵容延续性和信心强",
      impact: "positive",
      affectedMarkets: ["Moneyline", "Spain -2.5"],
      confidence: "high",
      importance: 86,
      summary: "Continuity supports Spain's favorite status, but it is more relevant to win probability than to 5+ goal totals.",
      summaryZh: "阵容延续性支撑西班牙胜率，但它更影响胜负，不等同于 5 球以上大球。",
      source: "The Guardian",
      sourceUrl: "https://www.theguardian.com/football/2026/jun/14/were-the-same-as-we-were-then-spain-confident-of-repeating-euros-success",
      publishedAt: "Jun 14"
    },
    {
      key: "odds-favorite-total-35",
      title: "External odds also price Spain as huge favorite with total at 3.5",
      titleZh: "外部赔率同样显示西班牙巨大热门，总进球主线在 3.5",
      impact: "watch",
      affectedMarkets: ["Moneyline", "Over 3.5", "Spain -2.5"],
      confidence: "high",
      importance: 82,
      summary: "The broad market agrees with Spain dominance; the trade question is whether derivative prices overstate the goal ceiling.",
      summaryZh: "大市场同意西班牙优势，真正问题是衍生盘口是否高估进球上限。",
      source: "FOX Sports",
      sourceUrl: "https://www.foxsports.com/stories/soccer/2026-world-cup-spain-cape-verde-odds-prediction-picks",
      publishedAt: "Jun 15"
    },
    {
      key: "cape-verde-debutant",
      title: "Cape Verde are World Cup debutants facing a tournament favorite",
      titleZh: "佛得角首次参加世界杯，首战面对夺冠热门",
      impact: "mixed",
      affectedMarkets: ["Spread", "Over 3.5", "BTTS"],
      confidence: "medium",
      importance: 78,
      summary: "Debutant status raises mismatch risk, but it does not by itself prove Cape Verde will collapse defensively.",
      summaryZh: "首次参赛提高实力差风险，但不能单独证明佛得角防线一定崩盘。",
      source: "Sports Illustrated",
      sourceUrl: "https://www.si.com/soccer/spain-vs-cabo-verde-world-cup-preview-predictions-lineups-6-15-26",
      publishedAt: "Jun 15"
    },
    {
      key: "cape-verde-form",
      title: "Cape Verde's recent form is less stable than Spain's",
      titleZh: "佛得角近期状态稳定性弱于西班牙",
      impact: "positive",
      affectedMarkets: ["Spain -2.5", "Cape Verde U0.5"],
      confidence: "medium",
      importance: 74,
      summary: "Form gap supports Spain pressure and clean-sheet scenarios, but must be checked against BTTS price.",
      summaryZh: "状态差支持西班牙压制和零封场景，但需要和双方进球价格一起验证。",
      source: "Barca Blaugranes",
      sourceUrl: "https://www.barcablaugranes.com/world-cup-2026/123471/spain-cape-verde-world-cup-2026-team-news-match-preview-lineups-prediction",
      publishedAt: "Jun 15"
    },
    {
      key: "livramento-attack",
      title: "Cape Verde expected to rely on Livramento leading the attack",
      titleZh: "佛得角预计依赖 Livramento 领衔进攻",
      impact: "watch",
      affectedMarkets: ["BTTS", "Cape Verde U0.5", "Over 3.5"],
      confidence: "medium",
      importance: 70,
      summary: "If Cape Verde can produce one transition goal, BTTS improves and high totals become less dependent on Spain scoring five alone.",
      summaryZh: "如果佛得角能靠转换打进一球，BTTS 改善，高阶大球也不必完全依赖西班牙单队进 5 球。",
      source: "Barca Blaugranes",
      sourceUrl: "https://www.barcablaugranes.com/world-cup-2026/123471/spain-cape-verde-world-cup-2026-team-news-match-preview-lineups-prediction",
      publishedAt: "Jun 15"
    },
    {
      key: "prediction-split",
      title: "Public previews split between 3-0 control and 5-1 blowout paths",
      titleZh: "公开赛前预测分歧：3-0 控制局 vs 5-1 大胜局",
      impact: "mixed",
      affectedMarkets: ["Over 4.5", "Over 5.5", "BTTS"],
      confidence: "medium",
      importance: 66,
      summary: "The disagreement mirrors CupEdge's concern: Spain dominance is clear, but 5+ total goals needs either full Spain efficiency or a Cape Verde goal.",
      summaryZh: "这正对应 CupEdge 的核心分歧：西班牙优势明确，但 5 球以上需要西班牙效率拉满或佛得角也进球。",
      source: "Lineups / Barca Blaugranes",
      sourceUrl: "https://www.lineups.com/betting/spain-vs-cape-verde-world-cup-match-preview-picks-odds-for-monday-june-15-2026/",
      publishedAt: "Jun 14-15"
    },
    {
      key: "polymarket-current-prices",
      title: "Polymarket derivative prices imply skepticism on the higher over ladder",
      titleZh: "Polymarket 当前衍生盘口对高阶大球更谨慎",
      impact: "watch",
      affectedMarkets: ["Over 3.5", "Over 4.5", "Over 5.5", "Spain -2.5"],
      confidence: "high",
      importance: 62,
      summary: `CupEdge fair xG is ${round(context.totalExpectedGoals, 2)} total, so compare price changes against lineup confirmation rather than treating every over as the same view.`,
      summaryZh: `CupEdge 总预期进球为 ${round(context.totalExpectedGoals, 2)}，应把价格变化和首发确认一起看，而不是把所有大球当成同一笔交易。`,
      source: "Polymarket",
      sourceUrl: "https://polymarket.com/zh/sports/world-cup/fifwc-esp-cvi-2026-06-15",
      publishedAt: "live market"
    }
  ] satisfies MatchNewsItem[];
}

function keywordHit(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function signalConfidence(text: string, keywords: string[], sourceCount: number): "high" | "medium" | "low" {
  if (keywordHit(text, keywords) && sourceCount >= 2) return "high";
  if (keywordHit(text, keywords) || sourceCount >= 3) return "medium";
  return "low";
}

function countResearchSources(value: string | null | undefined) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length;
    if (Array.isArray(parsed?.sources)) return parsed.sources.length;
  } catch {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }
  return 0;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
