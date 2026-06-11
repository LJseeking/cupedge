import type { Confidence, MoveSignal, TeamStatus, ValuationRow } from "@/lib/types/valuation";

export type Locale = "zh" | "en";

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "cupedge_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "zh" || value === "en";
}

export const dictionaries = {
  zh: {
    nav: {
      opportunities: "机会",
      markets: "市场",
      moves: "每日变化",
      methodology: "方法说明"
    },
    language: {
      label: "语言",
      zh: "中文",
      en: "English"
    },
    home: {
      tagline: "Polymarket 世界杯概率错配雷达。",
      subtitle: "找出世界杯冠军市场中被低估和高估的球队。",
      viewUndervalued: "查看低估球队",
      viewOvervalued: "查看高估球队",
      methodology: "方法说明",
      mostUndervalued: "最被低估",
      mostOvervalued: "最被高估",
      todaySignal: "今日市场信号",
      strongValueSignals: "Strong Value Signals",
      watchlist: "Watchlist",
      slightEdges: "Slight Edges",
      possibleOvervalued: "Possible Overvalued",
      advancedTable: "Advanced Table",
      advancedTableHint: "展开查看完整 48 队数据",
      strongOpportunities: "Strong Opportunities",
      biggestPositiveEdge: "Biggest Positive Edge",
      biggestNegativeEdge: "Biggest Negative Edge",
      noStrongOpportunity:
        "暂无强机会。当前最大 Edge 低于 5%，建议观察，不应视为明确交易机会。",
      conservativeSignal: "当前市场较接近公允定价，暂无明显低估机会。",
      strongSignalSummary: "发现 {count} 个强机会。请继续检查数据质量和价格变化。",
      watchSignalSummary: "暂无强机会，但有球队进入观察名单。当前更适合跟踪，不适合视为明确交易机会。",
      topFiveOpportunities: "Top 5 机会",
      dataQuality: "数据质量",
      signalStrength: "信号强度",
      emptyStrong: "暂无强机会",
      emptyWatch: "暂无观察名单",
      emptySlight: "暂无轻微信号",
      emptyOvervalued: "暂无明显高估",
      positiveTone: "价值偏低",
      negativeTone: "价格偏高",
      allTeams: "全部球队",
      teams: "支球队",
      poly: "Poly",
      fair: "Fair",
      conf: "置信"
    },
    table: {
      team: "球队",
      polymarket: "Polymarket",
      bookmaker: "博彩公司",
      fair: "公允概率",
      edge: "Edge",
      status: "高估/低估",
      confidence: "数据质量",
      signalStrength: "信号强度",
      updated: "更新时间"
    },
    signalStrength: {
      strong: "Strong",
      watch: "Watch",
      slight: "Slight",
      none: "None"
    },
    status: {
      undervalued: "低估",
      slightly_undervalued: "轻微低估",
      fair: "无明显高估/低估",
      slightly_overvalued: "轻微高估",
      overvalued: "高估"
    },
    confidence: {
      high: "高",
      medium: "中",
      low: "低"
    },
    team: {
      back: "返回榜单",
      bookmaker: "博彩公司",
      edgeScore: "Edge Score",
      signal: "信号",
      aiSeed: "AI 种子概率",
      explanation: "解释",
      summaryFair: "{team} 当前价格接近公允概率估计。",
      summaryUndervalued: "{team} 比公允概率估计低 {edge} 个百分点。",
      summaryOvervalued: "{team} 比公允概率估计高 {edge} 个百分点。",
      explanations: {
        undervalued: [
          "Polymarket 当前给出的价格低于公允概率估计。",
          "博彩公司隐含概率高于 Polymarket 当前价格。",
          "这个差值足以被标记为潜在价值机会。",
          "该信号是概率比较，不代表确定结果。"
        ],
        overvalued: [
          "Polymarket 当前给出的价格高于公允概率估计。",
          "市场可能正在为热度或近期叙事支付溢价。",
          "与公允概率估计相比，当前价格的价值有限。",
          "该信号不预测比赛结果，只比较市场定价。"
        ],
        fair: [
          "Polymarket 当前价格接近公允概率估计。",
          "博彩公司隐含概率和本地 AI 种子没有显示明显错配。",
          "Edge 处于中性区间，因此 CupEdge 标记为无明显高估/低估。"
        ]
      }
    },
    moves: {
      title: "每日变化",
      subtitle: "最近两次快照中的 Polymarket 概率与 CupEdge edge score 变化。",
      chartTitle: "Polymarket 价格变化",
      change: "变化",
      previousPolymarket: "上次 Polymarket",
      currentPolymarket: "当前 Polymarket",
      previousEdge: "上次 Edge",
      currentEdge: "当前 Edge",
      signal: "信号"
    },
    signals: {
      became_cheaper: "变便宜",
      became_expensive: "变贵",
      new_value_signal: "新低估信号",
      overheat_signal: "过热信号",
      stable: "稳定"
    },
    methodology: {
      title: "方法说明",
      intro:
        "CupEdge 扫描多个世界杯 Polymarket 市场，对比当前价格、公允概率估计、流动性和数据质量。本站不是自动交易系统，也不保证收益。",
      blocks: [
        {
          title: "扫描市场",
          body:
            "第一阶段覆盖冠军、小组冠军、进入16强、进入四分之一决赛、进入半决赛、洲际冠军和少量其他世界杯事件市场。"
        },
        {
          title: "Polymarket 价格",
          body:
            "CupEdge 优先使用 best bid 和 best ask 的中间价。如果没有 bid/ask 数据，则回退到可用的最新市场价格。"
        },
        {
          title: "博彩公司隐含概率",
          body:
            "Decimal odds 会转换为 implied probability = 1 / decimal odds。每家博彩公司内部会做归一化以去除 overround。"
        },
        {
          title: "公允概率",
          body:
            "冠军、小组冠军、进入16强、四分之一决赛和半决赛市场优先使用锦标赛 Monte Carlo 模拟生成公允概率。模拟以 Elo/SPI 或本地 seed strength 为球队强度锚点，并包含小组赛、最佳第三名和淘汰赛路径。若真实评分抓取失败，会使用本地 seed fallback 并降低信号质量。该模型只用于筛选观察信号，不是可靠预测。"
        },
        {
          title: "Value Edge",
          body:
            "Value Edge = Fair Probability / Polymarket Probability - 1。页面也会展示概率差；低价格长赔率机会会比单纯百分点差更醒目。"
        },
        {
          title: "关注分",
          body:
            "关注分综合赔率价值、概率差、流动性、24小时成交量和数据质量。流动性不足或数据质量低的信号不会排到首页前列。"
        },
        {
          title: "Basket Monitor",
          body:
            "小组冠军市场会监控 YES basket 总价。如果总价低于 1，可能存在理论空间，但滑点、盘口深度和真实成交价格可能吞噬该空间。"
        },
        {
          title: "数据质量",
          body:
            "高数据质量需要 Polymarket bid/ask、spread 小于 3 个百分点且存在博彩公司概率。中数据质量使用价格加博彩公司概率。低数据质量表示数据缺失或质量较低，不代表交易方向。"
        }
      ],
      statusRules: "状态规则",
      rules: [
        "Edge ≥ +5.0%：低估",
        "+2.0% 至 +5.0%：轻微低估",
        "-2.0% 至 +2.0%：无明显高估/低估",
        "-5.0% 至 -2.0%：轻微高估",
        "Edge ≤ -5.0%：高估"
      ]
    },
    disclaimer: {
      primary:
        "本站仅用于信息展示，不构成投资、博彩或交易建议。预测市场存在风险，价格可能快速波动。",
      secondary:
        "CupEdge is for informational purposes only. It does not provide financial, betting, or investment advice. Prediction markets are risky, and prices can change rapidly."
    }
  },
  en: {
    nav: {
      opportunities: "Opportunities",
      markets: "Markets",
      moves: "Moves",
      methodology: "Methodology"
    },
    language: {
      label: "Language",
      zh: "中文",
      en: "English"
    },
    home: {
      tagline: "AI-powered World Cup mispricing radar for Polymarket.",
      subtitle: "Find undervalued and overvalued World Cup teams on Polymarket.",
      viewUndervalued: "View Undervalued Teams",
      viewOvervalued: "View Overvalued Teams",
      methodology: "Methodology",
      mostUndervalued: "Most Undervalued",
      mostOvervalued: "Most Overvalued",
      todaySignal: "Today’s Market Signal",
      strongValueSignals: "Strong Value Signals",
      watchlist: "Watchlist",
      slightEdges: "Slight Edges",
      possibleOvervalued: "Possible Overvalued",
      advancedTable: "Advanced Table",
      advancedTableHint: "Expand to inspect all 48 teams",
      strongOpportunities: "Strong Opportunities",
      biggestPositiveEdge: "Biggest Positive Edge",
      biggestNegativeEdge: "Biggest Negative Edge",
      noStrongOpportunity:
        "No strong opportunities. The current biggest edge is below 5%, so this should be watched rather than treated as a clear trading opportunity.",
      conservativeSignal: "The market is close to fair pricing right now. There are no obvious undervalued opportunities.",
      strongSignalSummary: "{count} strong opportunities found. Check data quality and price movement before acting.",
      watchSignalSummary: "No strong opportunities, but some teams are on the watchlist. This is a tracking signal, not a clear opportunity.",
      topFiveOpportunities: "Top 5 Opportunities",
      dataQuality: "Data Quality",
      signalStrength: "Signal Strength",
      emptyStrong: "No strong opportunities",
      emptyWatch: "No watchlist teams",
      emptySlight: "No slight edges",
      emptyOvervalued: "No clear overvalued signals",
      positiveTone: "Long value",
      negativeTone: "Overpriced",
      allTeams: "All Teams",
      teams: "teams",
      poly: "Poly",
      fair: "Fair",
      conf: "Conf"
    },
    table: {
      team: "Team",
      polymarket: "Polymarket",
      bookmaker: "Bookmaker",
      fair: "Fair",
      edge: "Edge",
      status: "Mispricing",
      confidence: "Data Quality",
      signalStrength: "Signal Strength",
      updated: "Updated"
    },
    signalStrength: {
      strong: "Strong",
      watch: "Watch",
      slight: "Slight",
      none: "None"
    },
    status: {
      undervalued: "Undervalued",
      slightly_undervalued: "Slightly Undervalued",
      fair: "No Clear Mispricing",
      slightly_overvalued: "Slightly Overvalued",
      overvalued: "Overvalued"
    },
    confidence: {
      high: "High",
      medium: "Medium",
      low: "Low"
    },
    team: {
      back: "Back to dashboard",
      bookmaker: "Bookmaker",
      edgeScore: "Edge Score",
      signal: "Signal",
      aiSeed: "AI seed",
      explanation: "Explanation",
      summaryFair: "{team} is trading close to the current fair probability estimate.",
      summaryUndervalued: "{team} is priced below its fair probability estimate by {edge} percentage points.",
      summaryOvervalued: "{team} is priced above its fair probability estimate by {edge} percentage points.",
      explanations: {
        undervalued: [
          "Polymarket is pricing this team below its fair probability estimate.",
          "Bookmaker-implied probability is higher than the Polymarket price.",
          "The edge is large enough to be flagged as a potential value opportunity.",
          "The signal remains probabilistic and can change quickly as market prices move."
        ],
        overvalued: [
          "Polymarket is pricing this team above its fair probability estimate.",
          "The market may be overpaying for popularity or recent hype.",
          "The current price offers limited value compared with the fair probability estimate.",
          "The signal does not predict a result; it only compares current market pricing."
        ],
        fair: [
          "Polymarket is close to the current fair probability estimate.",
          "Bookmaker-implied probability and the simple AI seed do not show a large mismatch.",
          "The edge is inside the neutral range, so CupEdge marks it as no clear mispricing."
        ]
      }
    },
    moves: {
      title: "Daily Moves",
      subtitle: "Recent snapshot changes in Polymarket probability and CupEdge edge score.",
      chartTitle: "Polymarket Price Move",
      change: "Change",
      previousPolymarket: "Previous Polymarket",
      currentPolymarket: "Current Polymarket",
      previousEdge: "Previous Edge",
      currentEdge: "Current Edge",
      signal: "Signal"
    },
    signals: {
      became_cheaper: "Became Cheaper",
      became_expensive: "Became Expensive",
      new_value_signal: "New Value Signal",
      overheat_signal: "Overheat Signal",
      stable: "Stable"
    },
    methodology: {
      title: "Methodology",
      intro:
        "CupEdge scans multiple World Cup Polymarket markets and compares current prices with fair probability estimates, liquidity, volume, and data quality. It is not an auto-trading system and it does not guarantee returns.",
      blocks: [
        {
          title: "Scanned Markets",
          body:
            "Phase 1 covers winner, group winner, reach R16, reach quarter-final, reach semi-final, continent winner, and a small set of other World Cup event markets."
        },
        {
          title: "Polymarket Price",
          body:
            "CupEdge prefers the midpoint of best bid and best ask. If bid/ask data is unavailable, it falls back to the latest available market price."
        },
        {
          title: "Bookmaker Implied Probability",
          body:
            "Decimal odds are converted with implied probability = 1 / decimal odds. For each bookmaker, all team probabilities are normalized to remove overround."
        },
        {
          title: "Fair Probability",
          body:
            "Winner, group winner, R16, QF, and SF markets use a Monte Carlo tournament simulation to produce fair probabilities. The simulation uses Elo/SPI or local seed strength as the team-strength anchor and includes group matches, best third-place qualification, and knockout paths. If live ratings cannot be fetched, CupEdge uses local seed fallback and downgrades signal quality. This is for signal screening, not a reliable forecast."
        },
        {
          title: "Value Edge",
          body:
            "Value Edge = Fair Probability / Polymarket Probability - 1. CupEdge also shows probability gap; long-odds signals become more visible than with raw percentage-point edge alone."
        },
        {
          title: "Actionable Score",
          body:
            "Actionable Score combines value edge, probability gap, liquidity, 24h volume, and data quality. Thin or low-quality signals do not rank highly on the homepage."
        },
        {
          title: "Basket Monitor",
          body:
            "Group winner markets monitor the total YES basket price. If the basket total is below 1, theoretical space may exist, but slippage, depth, and actual fill prices can consume it."
        },
        {
          title: "Data Quality",
          body:
            "High data quality requires Polymarket bid/ask data, spread below 3 percentage points, and bookmaker probability. Medium data quality uses price plus bookmaker probability. Low data quality means missing or lower-quality data; it is not a trade direction."
        }
      ],
      statusRules: "Status Rules",
      rules: [
        "Edge ≥ +5.0%: Undervalued",
        "+2.0% to +5.0%: Slightly Undervalued",
        "-2.0% to +2.0%: No Clear Mispricing",
        "-5.0% to -2.0%: Slightly Overvalued",
        "Edge ≤ -5.0%: Overvalued"
      ]
    },
    disclaimer: {
      primary:
        "CupEdge is for informational purposes only. It does not provide financial, betting, or investment advice. Prediction markets are risky, and prices can change rapidly.",
      secondary:
        "本站仅用于信息展示，不构成投资、博彩或交易建议。预测市场存在风险，价格可能快速波动。"
    }
  }
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function statusLabel(status: TeamStatus | string, locale: Locale) {
  return dictionaries[locale].status[status as TeamStatus] ?? status;
}

export function confidenceLabel(confidence: Confidence | string, locale: Locale) {
  return dictionaries[locale].confidence[confidence as Confidence] ?? confidence;
}

export function signalLabel(signal: MoveSignal, locale: Locale) {
  return dictionaries[locale].signals[signal];
}

export type MarketSignalStrength = "strong" | "watch" | "slight" | "none";

export function marketSignalStrength(edgeScore: number): MarketSignalStrength {
  const absoluteEdge = Math.abs(edgeScore);
  if (absoluteEdge >= 0.05) return "strong";
  if (absoluteEdge >= 0.03) return "watch";
  if (absoluteEdge >= 0.01) return "slight";
  return "none";
}

export function marketSignalStrengthLabel(strength: MarketSignalStrength, locale: Locale) {
  return dictionaries[locale].signalStrength[strength];
}

export function homeSignalSummary(
  strongCount: number,
  biggestPositiveEdge: number,
  watchlistCount: number,
  locale: Locale
) {
  const t = dictionaries[locale].home;
  if (biggestPositiveEdge < 0.03) return t.conservativeSignal;
  if (strongCount === 0) return watchlistCount > 0 ? t.watchSignalSummary : t.noStrongOpportunity;
  return t.strongSignalSummary.replace("{count}", String(strongCount));
}

export function homeOpportunityExplanation(row: ValuationRow, locale: Locale) {
  const teamName = localizedTeamName(row.name, locale);
  const edge = Math.abs(row.edgeScore * 100).toFixed(1);
  const strength = marketSignalStrength(row.edgeScore);

  if (locale === "zh") {
    const direction = row.edgeScore >= 0 ? "低" : "高";
    const phrase =
      row.edgeScore >= 0
        ? positiveStrengthPhrase[strength]
        : negativeStrengthPhrase[strength];
    return `${teamName} 当前价格比公允概率${direction} ${edge} 个百分点，${phrase}`;
  }

  const direction = row.edgeScore >= 0 ? "below" : "above";
  const phrase =
    row.edgeScore >= 0
      ? englishPositiveStrengthPhrase[strength]
      : englishNegativeStrengthPhrase[strength];
  return `${teamName} is priced ${edge} percentage points ${direction} fair value. ${phrase}`;
}

function localizedTeamName(name: string, locale: Locale) {
  if (locale !== "zh") return name;
  return chineseTeamNames[name] ?? name;
}

const positiveStrengthPhrase: Record<MarketSignalStrength, string> = {
  strong: "属于强机会。",
  watch: "值得加入观察名单，但不应视为强机会。",
  slight: "属于轻微信号，不构成强机会。",
  none: "暂无明显低估信号。"
};

const negativeStrengthPhrase: Record<MarketSignalStrength, string> = {
  strong: "属于强高估信号。",
  watch: "属于可能高估信号，适合谨慎观察。",
  slight: "只是轻微高估信号。",
  none: "暂无明显高估信号。"
};

const englishPositiveStrengthPhrase: Record<MarketSignalStrength, string> = {
  strong: "This is a strong signal.",
  watch: "This belongs on the watchlist, not as a strong opportunity.",
  slight: "This is a slight edge, not a strong opportunity.",
  none: "This is not a clear undervalued signal."
};

const englishNegativeStrengthPhrase: Record<MarketSignalStrength, string> = {
  strong: "This is a strong overvalued signal.",
  watch: "This is a possible overvalued signal to watch carefully.",
  slight: "This is only a slight overvalued signal.",
  none: "This is not a clear overvalued signal."
};

const chineseTeamNames: Record<string, string> = {
  Mexico: "墨西哥",
  "South Africa": "南非",
  "South Korea": "韩国",
  Czechia: "捷克",
  Canada: "加拿大",
  "Bosnia and Herzegovina": "波黑",
  Qatar: "卡塔尔",
  Switzerland: "瑞士",
  Brazil: "巴西",
  Morocco: "摩洛哥",
  Haiti: "海地",
  Scotland: "苏格兰",
  "United States": "美国",
  Paraguay: "巴拉圭",
  Australia: "澳大利亚",
  Turkey: "土耳其",
  Germany: "德国",
  Curacao: "库拉索",
  "Ivory Coast": "科特迪瓦",
  Ecuador: "厄瓜多尔",
  Netherlands: "荷兰",
  Japan: "日本",
  Sweden: "瑞典",
  Tunisia: "突尼斯",
  Belgium: "比利时",
  Egypt: "埃及",
  Iran: "伊朗",
  "New Zealand": "新西兰",
  Spain: "西班牙",
  "Cape Verde": "佛得角",
  "Saudi Arabia": "沙特阿拉伯",
  Uruguay: "乌拉圭",
  France: "法国",
  Senegal: "塞内加尔",
  Iraq: "伊拉克",
  Norway: "挪威",
  Argentina: "阿根廷",
  Algeria: "阿尔及利亚",
  Austria: "奥地利",
  Jordan: "约旦",
  Portugal: "葡萄牙",
  "DR Congo": "刚果民主共和国",
  Uzbekistan: "乌兹别克斯坦",
  Colombia: "哥伦比亚",
  England: "英格兰",
  Croatia: "克罗地亚",
  Ghana: "加纳",
  Panama: "巴拿马"
};

export function teamSummary(row: ValuationRow, locale: Locale) {
  const t = dictionaries[locale].team;
  const edge = Math.abs(row.edgeScore * 100).toFixed(1);
  const template = row.status.includes("undervalued")
    ? t.summaryUndervalued
    : row.status.includes("overvalued")
      ? t.summaryOvervalued
      : t.summaryFair;
  return template.replace("{team}", row.name).replace("{edge}", edge);
}

export function teamExplanations(row: ValuationRow, locale: Locale) {
  const explanations = dictionaries[locale].team.explanations;
  if (row.status.includes("undervalued")) return [...explanations.undervalued];
  if (row.status.includes("overvalued")) return [...explanations.overvalued];
  return [...explanations.fair];
}
