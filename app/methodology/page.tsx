import { Disclaimer } from "@/components/disclaimer";
import { getLocale } from "@/lib/i18n-server";

export default async function MethodologyPage() {
  const locale = await getLocale();

  return (
    <main>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-line pb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {locale === "zh" ? "CupEdge 方法论" : "CupEdge Methodology"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {locale === "zh"
              ? "CupEdge 不是直接预测比分，也不是给下注指令。核心是把一场比赛拆成同一个公允比分分布，再用它统一定价胜平负、总进球、让球、球队进球和双方进球。"
              : "CupEdge does not issue picks or promise outcomes. It builds one fair score distribution for a match, then prices moneyline, totals, spreads, team totals, and BTTS from that same distribution."}
          </p>
        </div>

        <section className="mt-6 rounded-lg border border-line bg-panel p-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {locale === "zh" ? "怎么读首页" : "How To Read The Home Page"}
          </h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-400 md:grid-cols-3">
            <p>
              {locale === "zh"
                ? "先看公允概率表：市场价高于公允概率时，说明市场可能高估该玩法。"
                : "Start with the fair probability surface. If market price is above fair probability, that market may be rich."}
            </p>
            <p>
              {locale === "zh"
                ? "再看重要新闻：首发、伤病、轮换、战意和天气会改变比分分布。"
                : "Then read the news layer: lineups, injuries, rotation, motivation, and weather can move the score distribution."}
            </p>
            <p>
              {locale === "zh"
                ? "最后看盘口表达：同样看好强队，大胜、总进球和球队进球不是同一笔交易。"
                : "Finally choose the expression. A favorite view, spread view, total-goals view, and team-total view are different trades."}
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-4">
          <MethodBlock
            title={locale === "zh" ? "1. 比分分布" : "1. Score Distribution"}
            body={
              locale === "zh"
                ? "CupEdge 先估计两队预期进球，再生成比分矩阵。所有衍生玩法都从这张矩阵推导，避免 Over 4.5、BTTS、让球之间互相矛盾。"
                : "CupEdge estimates expected goals for both teams and builds a score matrix. Every derivative market is priced from that matrix so totals, BTTS, and spreads stay coherent."
            }
          />
          <MethodBlock
            title={locale === "zh" ? "2. 公允概率 vs 市场价格" : "2. Fair Probability vs Market Price"}
            body={
              locale === "zh"
                ? "Edge = 公允概率 - 当前可买价格。正 Edge 只是提示市场可能便宜，仍需要流动性、盘口深度和新闻确认。"
                : "Edge = fair probability minus current buy price. Positive edge only suggests possible mispricing; liquidity, depth, and news confirmation still matter."
            }
          />
          <MethodBlock
            title={locale === "zh" ? "3. 新闻层" : "3. News Layer"}
            body={
              locale === "zh"
                ? "新闻不是普通资讯流，而是会影响盘口的事实集合。每条新闻都要标注影响方向、影响玩法和来源。"
                : "The news layer is not a generic feed. Each item must explain the direction, affected markets, and source."
            }
          />
          <MethodBlock
            title={locale === "zh" ? "4. 风险边界" : "4. Risk Boundary"}
            body={
              locale === "zh"
                ? "CupEdge 是研究台，不是投注建议。模型概率可能错，市场价格会变化，临场阵容可能推翻赛前判断。"
                : "CupEdge is a research desk, not betting advice. Model probabilities can be wrong, market prices move, and lineups can invalidate pre-match assumptions."
            }
          />
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
