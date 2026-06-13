import { clampProbability } from "@/lib/utils";

export const PROBABILITY_MODEL_VERSION = "cupedge-v2";

export type ProbabilityV2Input = {
  slug: string;
  teamName: string;
  polymarketProbability?: number | null;
  bookmakerProbability?: number | null;
  quantProbability?: number | null;
  seedProbability?: number | null;
};

export type LlmProbabilityAdjustment = {
  slug: string;
  adjustment: number;
  reason?: string;
  modelCount: number;
  deepseekResearch?: string;
  gptSummary?: string;
  researchSources?: string;
};

export type ProbabilityV2Result = {
  marketConsensusProbability: number;
  quantProbability: number;
  llmAdjustment: number;
  llmAdjustmentReason?: string;
  llmModelCount: number;
  deepseekResearch?: string;
  gptSummary?: string;
  researchSources?: string;
  fairProbability: number;
  probabilityModelVersion: string;
};

type RawModelAdjustment = {
  slug?: unknown;
  adjustment?: unknown;
  confidence?: unknown;
  reason?: unknown;
  deepseekResearch?: unknown;
  gptSummary?: unknown;
  sources?: unknown;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type OpenAIResponsesResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type AnthropicMessagesResponse = {
  content?: Array<{
    text?: string;
    type?: string;
  }>;
};

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

const DEFAULT_MAX_LLM_ADJUSTMENT = 0.03;

export function calculateProbabilityV2(
  input: ProbabilityV2Input,
  llmAdjustment?: LlmProbabilityAdjustment
): ProbabilityV2Result {
  const quantProbability = clampProbability(
    input.quantProbability ?? input.seedProbability ?? input.bookmakerProbability ?? input.polymarketProbability ?? 0
  );
  const marketConsensusProbability = calculateMarketConsensusProbability({
    bookmakerProbability: input.bookmakerProbability,
    polymarketProbability: input.polymarketProbability,
    fallbackProbability: quantProbability
  });
  const boundedLlmAdjustment = boundLlmAdjustment(llmAdjustment?.adjustment ?? 0);
  const baseProbability = weightedAvailableAverage([
    { value: input.bookmakerProbability, weight: 0.45 },
    { value: input.polymarketProbability, weight: 0.25 },
    { value: quantProbability, weight: 0.3 }
  ]);

  return {
    marketConsensusProbability,
    quantProbability,
    llmAdjustment: boundedLlmAdjustment,
    llmAdjustmentReason: llmAdjustment?.reason,
    llmModelCount: llmAdjustment?.modelCount ?? 0,
    deepseekResearch: llmAdjustment?.deepseekResearch,
    gptSummary: llmAdjustment?.gptSummary,
    researchSources: llmAdjustment?.researchSources,
    fairProbability: clampProbability(baseProbability + boundedLlmAdjustment),
    probabilityModelVersion: PROBABILITY_MODEL_VERSION
  };
}

export function calculateMarketConsensusProbability({
  bookmakerProbability,
  polymarketProbability,
  fallbackProbability
}: {
  bookmakerProbability?: number | null;
  polymarketProbability?: number | null;
  fallbackProbability: number;
}) {
  return weightedAvailableAverage([
    { value: bookmakerProbability, weight: 0.65 },
    { value: polymarketProbability, weight: 0.35 }
  ], fallbackProbability);
}

export async function getLlmProbabilityAdjustments(
  inputs: ProbabilityV2Input[]
): Promise<Map<string, LlmProbabilityAdjustment>> {
  if ((process.env.LLM_ADJUSTMENT_ENABLED ?? "false").toLowerCase() !== "true") {
    return new Map();
  }

  const maxAdjustment = getMaxLlmAdjustment();
  const researchEnabled = (process.env.LLM_RESEARCH_ENABLED ?? "false").toLowerCase() === "true";
  if (researchEnabled && isDeepSeekGeminiPipeline()) {
    return getTavilyDeepSeekGeminiAdjustments(inputs, maxAdjustment);
  }

  const provider = normalizeProvider(process.env.LLM_PROVIDER);
  const apiKey = getProviderApiKey(provider);
  const models = getConfiguredModels(provider);
  if (!apiKey || models.length === 0) return new Map();

  const settled = await Promise.allSettled(
    models.map((model) =>
      researchEnabled
        ? fetchResearchModelAdjustments(provider, model, inputs, apiKey, maxAdjustment)
        : fetchModelAdjustments(model, inputs, apiKey, maxAdjustment)
    )
  );
  const bySlug = new Map<string, LlmProbabilityAdjustment[]>();

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      console.warn("LLM probability adjustment failed.", result.reason);
      continue;
    }
    for (const item of result.value) {
      bySlug.set(item.slug, [
        ...(bySlug.get(item.slug) ?? []),
        {
          slug: item.slug,
          adjustment: item.adjustment,
          reason: item.reason,
          modelCount: 1,
          deepseekResearch: item.deepseekResearch,
          gptSummary: item.gptSummary,
          researchSources: item.researchSources
        }
      ]);
    }
  }

  const aggregated = new Map<string, LlmProbabilityAdjustment>();
  for (const [slug, adjustments] of bySlug.entries()) {
    if (!adjustments.length) continue;
    const adjustment = boundLlmAdjustment(
      median(adjustments.map((item) => item.adjustment)),
      maxAdjustment
    );
    const reason = adjustments
      .map((item) => item.reason)
      .filter(Boolean)
      .slice(0, 2)
      .join(" | ");
    aggregated.set(slug, {
      slug,
      adjustment,
      reason: reason || undefined,
      modelCount: adjustments.length,
      deepseekResearch: firstText(adjustments.map((item) => item.deepseekResearch)),
      gptSummary: firstText(adjustments.map((item) => item.gptSummary)),
      researchSources: firstText(adjustments.map((item) => item.researchSources))
    });
  }

  return aggregated;
}

async function getTavilyDeepSeekGeminiAdjustments(
  inputs: ProbabilityV2Input[],
  maxAdjustment: number
): Promise<Map<string, LlmProbabilityAdjustment>> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.LLM_SUMMARY_API_KEY;
  if (!tavilyKey || !deepseekKey || !geminiKey) {
    console.warn("Tavily/DeepSeek/Gemini research pipeline skipped because one or more API keys are missing.");
    return new Map();
  }

  const searchResults = await fetchTavilyResearchResults(tavilyKey);
  if (!searchResults.length) return new Map();

  const deepseekResearch = await fetchDeepSeekResearch(inputs, searchResults, deepseekKey);
  let geminiAdjustments: LlmProbabilityAdjustment[] = [];
  try {
    geminiAdjustments = await fetchGeminiSummaryAdjustments(
      inputs,
      searchResults,
      deepseekResearch,
      geminiKey,
      maxAdjustment
    );
  } catch (error) {
    console.warn("Gemini summary adjustment failed. Continuing with DeepSeek-only research.", error);
    return buildDeepSeekOnlyAdjustments(deepseekResearch);
  }

  if (!geminiAdjustments.length) {
    return buildDeepSeekOnlyAdjustments(deepseekResearch);
  }

  const bySlug = new Map<string, LlmProbabilityAdjustment>();
  for (const adjustment of geminiAdjustments) {
    const research = deepseekResearch.find((item) => item.slug === adjustment.slug);
    bySlug.set(adjustment.slug, {
      ...adjustment,
      modelCount: 2,
      deepseekResearch: research?.deepseekResearch,
      gptSummary: adjustment.gptSummary ?? adjustment.reason,
      researchSources: adjustment.researchSources ?? research?.researchSources
    });
  }
  return bySlug;
}

function buildDeepSeekOnlyAdjustments(
  deepseekResearch: Array<{ slug: string; deepseekResearch?: string; researchSources?: string }>
) {
  const bySlug = new Map<string, LlmProbabilityAdjustment>();
  for (const research of deepseekResearch) {
    bySlug.set(research.slug, {
      slug: research.slug,
      adjustment: 0,
      reason: "Gemini summary unavailable; using DeepSeek research without final probability adjustment.",
      modelCount: 1,
      deepseekResearch: research.deepseekResearch,
      gptSummary: undefined,
      researchSources: research.researchSources
    });
  }
  return bySlug;
}

async function fetchTavilyResearchResults(apiKey: string): Promise<TavilySearchResult[]> {
  const queries = getResearchQueries();
  const maxResults = Number(process.env.RESEARCH_SEARCH_MAX_RESULTS ?? "5");
  const settled = await Promise.allSettled(
    queries.map((query) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          topic: process.env.RESEARCH_SEARCH_TOPIC || "news",
          search_depth: process.env.RESEARCH_SEARCH_DEPTH || "basic",
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false
        }),
        signal: AbortSignal.timeout(Number(process.env.RESEARCH_SEARCH_TIMEOUT_MS ?? "30000"))
      }).then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`Tavily search returned ${response.status}: ${body.slice(0, 300)}`);
        }
        return response.json() as Promise<{ results?: TavilySearchResult[] }>;
      })
    )
  );

  const seen = new Set<string>();
  const results: TavilySearchResult[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") {
      console.warn("Tavily research query failed.", result.reason);
      continue;
    }
    for (const item of result.value.results ?? []) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      results.push(item);
    }
  }
  return results.slice(0, Number(process.env.RESEARCH_SEARCH_TOTAL_MAX_RESULTS ?? "20"));
}

async function fetchDeepSeekResearch(
  inputs: ProbabilityV2Input[],
  searchResults: TavilySearchResult[],
  apiKey: string
) {
  const apiBase = (process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a low-cost football research extractor. Read provided search snippets and map relevant evidence to teams. Do not invent facts. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Extract team-specific current information that may affect 2026 World Cup forecasting. Focus on injuries, squad availability, manager changes, recent form, qualifying context, and credible market-moving news.",
            teams: inputs.map((input) => ({ slug: input.slug, teamName: input.teamName })),
            searchResults: searchResults.map((result) => ({
              title: result.title,
              url: result.url,
              content: result.content,
              publishedDate: result.published_date
            })),
            outputShape: {
              teams: [
                {
                  slug: "team-slug",
                  deepseekResearch: "short factual research note",
                  sentiment: "positive|negative|neutral",
                  confidence: "low|medium|high",
                  sources: ["https://example.com/source"]
                }
              ]
            }
          })
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.DEEPSEEK_RESEARCH_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DeepSeek research returned ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = safeParseJson(content);
  const payload = typeof parsed === "object" && parsed !== null
    ? parsed as { teams?: RawModelAdjustment[] }
    : {};
  return (Array.isArray(payload.teams) ? payload.teams : [])
    .map((item) => {
      const slug = typeof item.slug === "string" ? item.slug : "";
      if (!slug) return null;
      return {
        slug,
        deepseekResearch: typeof item.deepseekResearch === "string"
          ? item.deepseekResearch.slice(0, 900)
          : typeof item.reason === "string"
            ? item.reason.slice(0, 900)
            : undefined,
        researchSources: stringifySources(item.sources)
      };
    })
    .filter(Boolean) as Array<{ slug: string; deepseekResearch?: string; researchSources?: string }>;
}

async function fetchGeminiSummaryAdjustments(
  inputs: ProbabilityV2Input[],
  searchResults: TavilySearchResult[],
  deepseekResearch: Array<{ slug: string; deepseekResearch?: string; researchSources?: string }>,
  apiKey: string,
  maxAdjustment: number
) {
  const apiBase = normalizeOpenAiCompatibleBase(
    process.env.GEMINI_API_BASE ||
      process.env.LLM_SUMMARY_API_BASE ||
      "https://platform.powermatrix.tech"
  );
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GEMINI_SUMMARY_MODEL || process.env.LLM_SUMMARY_MODEL || "gemini-2.5-flash",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are Gemini, the final football forecasting calibration reviewer. Use DeepSeek research plus source snippets to summarize and set a tiny bounded adjustment. Do not invent sources. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Review DeepSeek's team research and the original search snippets. Produce final bounded adjustments and a concise Gemini summary for display.",
            maxAdjustment,
            teams: inputs,
            deepseekResearch,
            searchResults: searchResults.map((result) => ({
              title: result.title,
              url: result.url,
              content: result.content,
              publishedDate: result.published_date
            })),
            outputShape: {
              adjustments: [
                {
                  slug: "team-slug",
                  adjustment: 0,
                  reason: "final short reason",
                  gptSummary: "display summary from Gemini",
                  sources: ["https://example.com/source"]
                }
              ]
            },
            rules: [
              "Do not exceed maxAdjustment in either direction.",
              "Use 0 when evidence is weak, old, or unrelated.",
              "Most adjustments should be between -0.01 and +0.01.",
              "Return JSON only."
            ]
          })
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.GEMINI_SUMMARY_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini summary adjustment returned ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return parseAdjustmentPayload(data.choices?.[0]?.message?.content ?? "", maxAdjustment);
}

async function fetchModelAdjustments(
  model: string,
  inputs: ProbabilityV2Input[],
  apiKey: string,
  maxAdjustment: number
) {
  const apiBase = (process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a cautious football forecasting reviewer. Do not produce raw probabilities. Only suggest small calibration adjustments to an existing model. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "For each team, suggest an adjustment in probability points as a decimal between negative maxAdjustment and positive maxAdjustment. Use 0 when there is no strong reason. Do not exceed the limit.",
            maxAdjustment,
            teams: inputs.map((input) => ({
              slug: input.slug,
              teamName: input.teamName,
              polymarketProbability: input.polymarketProbability,
              bookmakerProbability: input.bookmakerProbability,
              quantProbability: input.quantProbability,
              seedProbability: input.seedProbability
            })),
            outputShape: {
              adjustments: [
                {
                  slug: "team-slug",
                  adjustment: 0,
                  confidence: "low|medium|high",
                  reason: "short reason"
                }
              ]
            }
          })
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.LLM_ADJUSTMENT_TIMEOUT_MS ?? "25000"))
  });

  if (!response.ok) {
    throw new Error(`LLM adjustment request for ${model} returned ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = safeParseJson(content);
  const payload = typeof parsed === "object" && parsed !== null
    ? parsed as { adjustments?: RawModelAdjustment[] }
    : {};
  const rawAdjustments = Array.isArray(payload.adjustments) ? payload.adjustments : [];

  return rawAdjustments
    .map((item) => normalizeModelAdjustment(item, maxAdjustment))
    .filter(Boolean) as LlmProbabilityAdjustment[];
}

async function fetchResearchModelAdjustments(
  provider: "openai" | "anthropic",
  model: string,
  inputs: ProbabilityV2Input[],
  apiKey: string,
  maxAdjustment: number
) {
  if (provider === "anthropic") {
    return fetchAnthropicResearchAdjustments(model, inputs, apiKey, maxAdjustment);
  }
  return fetchOpenAIResearchAdjustments(model, inputs, apiKey, maxAdjustment);
}

async function fetchOpenAIResearchAdjustments(
  model: string,
  inputs: ProbabilityV2Input[],
  apiKey: string,
  maxAdjustment: number
) {
  const apiBase = (process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const toolType = process.env.OPENAI_WEB_SEARCH_TOOL_TYPE || "web_search";
  const response = await fetch(`${apiBase}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      tools: [
        {
          type: toolType,
          search_context_size: process.env.LLM_RESEARCH_SEARCH_CONTEXT_SIZE || "medium"
        }
      ],
      input: [
        {
          role: "system",
          content: researchSystemPrompt()
        },
        {
          role: "user",
          content: researchUserPrompt(inputs, maxAdjustment)
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.LLM_RESEARCH_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI research adjustment for ${model} returned ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as OpenAIResponsesResponse;
  const content = extractOpenAIResponseText(data);
  return parseAdjustmentPayload(content, maxAdjustment);
}

async function fetchAnthropicResearchAdjustments(
  model: string,
  inputs: ProbabilityV2Input[],
  apiKey: string,
  maxAdjustment: number
) {
  const apiBase = (process.env.LLM_API_BASE || "https://api.anthropic.com/v1").replace(/\/$/, "");
  const toolType = process.env.ANTHROPIC_WEB_SEARCH_TOOL_TYPE || "web_search_20250305";
  const response = await fetch(`${apiBase}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.LLM_RESEARCH_MAX_TOKENS ?? "6000"),
      temperature: 0.1,
      system: researchSystemPrompt(),
      tools: [
        {
          type: toolType,
          name: "web_search",
          max_uses: Number(process.env.LLM_RESEARCH_MAX_SEARCHES ?? "20")
        }
      ],
      messages: [
        {
          role: "user",
          content: researchUserPrompt(inputs, maxAdjustment)
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.LLM_RESEARCH_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic research adjustment for ${model} returned ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as AnthropicMessagesResponse;
  const content = data.content?.map((item) => item.text).filter(Boolean).join("\n") ?? "";
  return parseAdjustmentPayload(content, maxAdjustment);
}

function researchSystemPrompt() {
  return [
    "You are a cautious football forecasting research analyst.",
    "You must search the web for fresh, reliable information before producing adjustments.",
    "Use official team, federation, tournament, reputable sports-news, injury, lineup, and recent-form sources when available.",
    "Do not produce standalone win probabilities. Only suggest small calibration adjustments to the provided baseline model.",
    "Return strict JSON only."
  ].join(" ");
}

function researchUserPrompt(inputs: ProbabilityV2Input[], maxAdjustment: number) {
  return JSON.stringify({
    task:
      "Search current web information for 2026 FIFA World Cup teams, then suggest a bounded probability adjustment for each team. Consider injuries, squad availability, manager changes, recent form, fixture path, qualifying context, and credible market-moving news. Use 0 when evidence is weak or stale.",
    maxAdjustment,
    adjustmentMeaning:
      "A decimal probability-point delta added to CupEdge's baseline fair probability. Example: 0.01 means +1 percentage point.",
    teams: inputs.map((input) => ({
      slug: input.slug,
      teamName: input.teamName,
      polymarketProbability: input.polymarketProbability,
      bookmakerProbability: input.bookmakerProbability,
      quantProbability: input.quantProbability,
      seedProbability: input.seedProbability
    })),
    outputShape: {
      adjustments: [
        {
          slug: "team-slug",
          adjustment: 0,
          confidence: "low|medium|high",
          reason: "one sentence with the most relevant evidence",
          sources: ["https://example.com/source"]
        }
      ]
    },
    rules: [
      "Do not exceed maxAdjustment in either direction.",
      "Prefer small adjustments: most teams should be between -0.01 and +0.01.",
      "Use 0 for teams without fresh, reliable evidence.",
      "Include source URLs in the reason or sources field.",
      "Return JSON only, without markdown."
    ]
  });
}

function parseAdjustmentPayload(content: string, maxAdjustment: number) {
  if (!content) return [];
  const parsed = safeParseJson(content);
  const payload = typeof parsed === "object" && parsed !== null
    ? parsed as { adjustments?: RawModelAdjustment[] }
    : {};
  const rawAdjustments = Array.isArray(payload.adjustments) ? payload.adjustments : [];
  return rawAdjustments
    .map((item) => normalizeModelAdjustment(item, maxAdjustment))
    .filter(Boolean) as LlmProbabilityAdjustment[];
}

function normalizeModelAdjustment(item: RawModelAdjustment, maxAdjustment: number) {
  const slug = typeof item.slug === "string" ? item.slug : "";
  const adjustment = typeof item.adjustment === "number" ? item.adjustment : Number(item.adjustment);
  if (!slug || !Number.isFinite(adjustment)) return null;
  const sources = Array.isArray((item as { sources?: unknown }).sources)
    ? ((item as { sources?: unknown[] }).sources ?? [])
        .filter((source): source is string => typeof source === "string")
        .slice(0, 3)
    : [];
  const reason = typeof item.reason === "string" ? item.reason : "";
  const gptSummary = typeof item.gptSummary === "string" ? item.gptSummary : "";
  const deepseekResearch = typeof item.deepseekResearch === "string" ? item.deepseekResearch : "";
  const researchSources = stringifySources(sources);
  const reasonWithSources = [reason, sources.length ? `Sources: ${sources.join(", ")}` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    slug,
    adjustment: boundLlmAdjustment(adjustment, maxAdjustment),
    reason: reasonWithSources ? reasonWithSources.slice(0, 700) : undefined,
    modelCount: 1,
    deepseekResearch: deepseekResearch ? deepseekResearch.slice(0, 900) : undefined,
    gptSummary: gptSummary ? gptSummary.slice(0, 900) : undefined,
    researchSources
  };
}

function getResearchQueries() {
  const configured = parseList(process.env.RESEARCH_SEARCH_QUERIES);
  if (configured.length) {
    return configured.slice(0, Number(process.env.RESEARCH_SEARCH_QUERIES_PER_UPDATE ?? "4"));
  }
  return [
    "2026 FIFA World Cup latest injuries squad news national teams",
    "2026 World Cup Spain Argentina France Brazil England injury squad form news",
    "2026 FIFA World Cup qualification team news manager injury latest",
    "Polymarket World Cup winner football latest news injuries squad"
  ].slice(0, Number(process.env.RESEARCH_SEARCH_QUERIES_PER_UPDATE ?? "4"));
}

function stringifySources(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const sources = value
    .filter((source): source is string => typeof source === "string")
    .slice(0, 5);
  return sources.length ? sources.join("\n") : undefined;
}

function firstText(values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0);
}

function normalizeProvider(value: string | undefined): "openai" | "anthropic" {
  return value?.toLowerCase() === "anthropic" ? "anthropic" : "openai";
}

function getProviderApiKey(provider: "openai" | "anthropic") {
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
  }
  return process.env.LLM_API_KEY;
}

function getConfiguredModels(provider: "openai" | "anthropic") {
  const researchEnabled = (process.env.LLM_RESEARCH_ENABLED ?? "false").toLowerCase() === "true";
  if (researchEnabled && process.env.LLM_RESEARCH_MODEL) return [process.env.LLM_RESEARCH_MODEL];
  const models = parseList(process.env.LLM_MODELS);
  if (models.length) return models;
  if (provider === "anthropic") return [];
  return [];
}

function isDeepSeekGeminiPipeline() {
  return process.env.LLM_RESEARCH_PIPELINE === "tavily-deepseek-gemini";
}

function normalizeOpenAiCompatibleBase(value: string) {
  const trimmed = value.replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/v1";
      return url.toString().replace(/\/$/, "");
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function extractOpenAIResponseText(data: OpenAIResponsesResponse) {
  if (data.output_text) return data.output_text;
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n") ?? "";
}

function weightedAvailableAverage(
  values: Array<{ value?: number | null; weight: number }>,
  fallback = 0
) {
  let numerator = 0;
  let denominator = 0;
  for (const item of values) {
    if (item.value === undefined || item.value === null || !Number.isFinite(item.value)) continue;
    numerator += clampProbability(item.value) * item.weight;
    denominator += item.weight;
  }
  if (denominator <= 0) return clampProbability(fallback);
  return clampProbability(numerator / denominator);
}

function boundLlmAdjustment(value: number, maxAdjustment = getMaxLlmAdjustment()) {
  if (!Number.isFinite(value)) return 0;
  const max = Math.max(0, maxAdjustment);
  return Math.min(max, Math.max(-max, value));
}

function getMaxLlmAdjustment() {
  const configured = Number(process.env.LLM_ADJUSTMENT_MAX_ABS ?? DEFAULT_MAX_LLM_ADJUSTMENT);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 0), 0.08) : DEFAULT_MAX_LLM_ADJUSTMENT;
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function median(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
