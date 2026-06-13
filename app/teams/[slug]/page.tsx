import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { MetricCard } from "@/components/metric-card";
import { ResearchInsightPanel } from "@/components/research-insight-panel";
import { ConfidenceText, StatusBadge } from "@/components/status-badge";
import { getDictionary, teamExplanations, teamSummary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getResearchInsightForTeam } from "@/lib/services/research-insights";
import { getTeamDetail } from "@/lib/services/valuation";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const team = await getTeamDetail(slug);
  if (!team) notFound();
  const summary = teamSummary(team, locale);
  const explanations = teamExplanations(team, locale);
  const researchInsight = await getResearchInsightForTeam(team.slug);

  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t.team.back}
        </Link>

        <div className="mt-6 border-b border-line pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-4xl font-semibold tracking-tight text-zinc-100">
              {team.name}
            </h1>
            <StatusBadge status={team.status} locale={locale} />
          </div>
          <p className="mt-3 max-w-2xl text-zinc-400">{summary}</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Polymarket" value={percent(team.polymarketProbability)} />
          <MetricCard label={t.team.bookmaker} value={percent(team.bookmakerProbability)} />
          <MetricCard label={t.table.fair} value={percent(team.fairProbability)} />
          <MetricCard
            label={t.team.edgeScore}
            value={signedPercent(team.edgeScore)}
            tone={team.edgeScore >= 0.02 ? "positive" : team.edgeScore <= -0.02 ? "negative" : "neutral"}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={locale === "zh" ? "市场共识" : "Market Consensus"}
            value={percent(team.marketConsensusProbability)}
          />
          <MetricCard
            label={locale === "zh" ? "量化模拟" : "Quant Simulation"}
            value={percent(team.quantProbability ?? team.aiProbability)}
          />
          <MetricCard
            label={locale === "zh" ? "LLM 修正" : "LLM Adjustment"}
            value={signedPercent(team.llmAdjustment ?? 0)}
            tone={(team.llmAdjustment ?? 0) > 0 ? "positive" : (team.llmAdjustment ?? 0) < 0 ? "negative" : "neutral"}
          />
          <MetricCard
            label={locale === "zh" ? "概率版本" : "Model Version"}
            value={team.probabilityModelVersion ?? "cupedge-v2"}
          />
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {t.team.signal}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">{t.table.status}</dt>
                <dd>
                  <StatusBadge status={team.status} locale={locale} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">{t.table.confidence}</dt>
                <dd>
                  <ConfidenceText confidence={team.confidence} locale={locale} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">{t.team.aiSeed}</dt>
                <dd className="font-mono text-zinc-100">{percent(team.aiProbability)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">{locale === "zh" ? "LLM 模型数" : "LLM Models"}</dt>
                <dd className="font-mono text-zinc-100">{team.llmModelCount ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">{t.table.edge}</dt>
                <dd className={`font-mono font-semibold ${edgeTextClasses(team.edgeScore)}`}>
                  {signedPercent(team.edgeScore)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {t.team.explanation}
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
              {explanations.map((explanation) => (
                <li key={explanation} className="border-l border-line pl-3">
                  {explanation}
                </li>
              ))}
              {team.llmAdjustmentReason ? (
                <li className="border-l border-line pl-3 text-zinc-400">
                  {locale === "zh" ? "LLM 修正理由：" : "LLM adjustment: "}
                  {team.llmAdjustmentReason}
                </li>
              ) : null}
            </ul>
          </div>
        </section>

        <ResearchInsightPanel insight={researchInsight} locale={locale} />
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}
