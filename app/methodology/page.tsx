import { Disclaimer } from "@/components/disclaimer";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function MethodologyPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <main>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-line pb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {t.methodology.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{t.methodology.intro}</p>
        </div>

        <section className="mt-6 rounded-lg border border-line bg-panel p-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {locale === "zh" ? "普通用户怎么读" : "How To Read CupEdge"}
          </h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-400 md:grid-cols-3">
            <p>
              {locale === "zh"
                ? "先看首页结论：如果没有 A/B 级信号，就把它当作观赛雷达。"
                : "Start with the homepage call. If there are no A/B signals, treat it as a watch radar."}
            </p>
            <p>
              {locale === "zh"
                ? "再看具体市场：市场名称、YES/NO 方向、当前价格和模型概率。"
                : "Then read the market, YES/NO side, current price, and model probability."}
            </p>
            <p>
              {locale === "zh"
                ? "最后看风险：待验证、低流动性或未建模信号不进入决策层。"
                : "Finally check risk. Demo, thin, or unmodeled signals stay out of the decision layer."}
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-4">
          {t.methodology.blocks.map((block) => (
            <MethodBlock key={block.title} title={block.title} body={block.body} />
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-line bg-panel p-4">
          <div className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {t.methodology.statusRules}
          </div>
          <div className="mt-4 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
            {t.methodology.rules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
        </div>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function MethodBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
    </section>
  );
}
