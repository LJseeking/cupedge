import type { ResearchInsight } from "@/lib/types/research";
import { signedPercent } from "@/lib/utils";

export function ResearchInsightPanel({
  insight,
  locale,
  title
}: {
  insight?: ResearchInsight | null;
  locale: "zh" | "en";
  title?: string;
}) {
  const deepseekBody = insight?.deepseekResearch ??
    (locale === "zh"
      ? "等待下一次 update-data：Tavily 搜索后，DeepSeek 会在这里提取球队新闻、伤停、赛果和赛程影响因子。"
      : "Waiting for the next update-data run: DeepSeek will extract team news, injuries, results, and schedule factors after Tavily search.");
  const gptBody = insight?.gptSummary ??
    (locale === "zh"
      ? "等待下一次 update-data：GPT 会在这里总结 DeepSeek 结论，并给出最终概率校准。"
      : "Waiting for the next update-data run: GPT will summarize DeepSeek findings and provide the final probability calibration.");

  return (
    <section className="mt-6 rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {title ?? (locale === "zh" ? "双模型研究结果" : "Dual-Model Research")}
          </h2>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {locale === "zh"
              ? "Tavily 搜索最新信息，DeepSeek 提取影响因子，GPT 进行总结与概率校准。"
              : "Tavily searches fresh information, DeepSeek extracts impact factors, and GPT summarizes/calibrates."}
          </p>
        </div>
        <div className="rounded border border-line bg-zinc-950 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-600">
            {locale === "zh" ? "最终修正" : "Final Adjustment"}
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
            {signedPercent(insight?.llmAdjustment ?? 0)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ResearchBlock
          title="DeepSeek Research"
          body={deepseekBody}
        />
        <ResearchBlock
          title="GPT Summary"
          body={gptBody}
          sources={insight?.researchSources}
        />
      </div>
    </section>
  );
}

function ResearchBlock({
  title,
  body,
  sources
}: {
  title: string;
  body: string;
  sources?: string | null;
}) {
  const sourceList = (sources ?? "")
    .split(/\n+/)
    .map((source) => source.trim())
    .filter(Boolean);

  return (
    <div className="rounded border border-line bg-zinc-950/40 p-4">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p>
      {sourceList.length ? (
        <div className="mt-4 space-y-2">
          {sourceList.map((source) => (
            <a
              key={source}
              href={source}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-zinc-500 hover:text-zinc-200"
            >
              {source}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
