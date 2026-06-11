import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { marketTypeText, OpportunityCard } from "@/components/opportunity-card";
import { getLocale } from "@/lib/i18n-server";
import { getMarketOpportunities } from "@/lib/services/opportunities";
import { getOpportunityTrustTier, trustTierText } from "@/lib/services/opportunity-trust";
import type { MarketOpportunity } from "@/lib/types/opportunity";

export const dynamic = "force-dynamic";

const signalFilters = [
  "all",
  "strong_edge",
  "watchlist",
  "overheated",
  "basket",
  "mild_edge"
] as const;

const trustFilters = ["all", "LIVE_VERIFIED", "MODEL_WATCHLIST", "DEMO_NEEDS_VERIFICATION"] as const;

export default async function OpportunitiesPage({
  searchParams
}: {
  searchParams: Promise<{ signal?: string; marketType?: string; trust?: string }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const signal = signalFilters.includes(params.signal as (typeof signalFilters)[number])
    ? params.signal
    : "all";
  const trust = trustFilters.includes(params.trust as (typeof trustFilters)[number])
    ? params.trust
    : "all";
  const marketType = params.marketType ?? "all";
  const opportunities = await getMarketOpportunities();
  const filtered = opportunities.filter((item) => {
    const signalMatch =
      signal === "all" ||
      item.signalStrength === signal ||
      (signal === "basket" && item.side === "BASKET");
    const marketMatch = marketType === "all" || item.marketType === marketType;
    const trustMatch = trust === "all" || getOpportunityTrustTier(item) === trust;
    return signalMatch && marketMatch && trustMatch;
  });
  const marketTypes = ["all", ...new Set(opportunities.map((item) => item.marketType))];

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {locale === "zh" ? "全部机会" : "All Opportunities"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "按可信层级、信号强度和市场类型查看世界杯机会。普通用户可以优先看 Live Verified 和 Model Watchlist，Demo / 待验证只适合复核。"
              : "Review World Cup signals by trust tier, strength, and market type. Demo / needs-verification items stay out of the homepage decision layer."}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {locale === "zh" ? `当前筛选结果：${filtered.length} 条` : `${filtered.length} results in the current filter`}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {trustFilters.map((item) => (
            <FilterLink
              key={item}
              href={`/opportunities?trust=${item}&signal=${signal}&marketType=${marketType}`}
              active={trust === item}
            >
              {trustLabel(item, locale)}
            </FilterLink>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {signalFilters.map((item) => (
            <FilterLink
              key={item}
              href={`/opportunities?trust=${trust}&signal=${item}&marketType=${marketType}`}
              active={signal === item}
            >
              {signalLabel(item, locale)}
            </FilterLink>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {marketTypes.map((item) => (
            <FilterLink
              key={item}
              href={`/opportunities?trust=${trust}&signal=${signal}&marketType=${item}`}
              active={marketType === item}
            >
              {item === "all" ? (locale === "zh" ? "全部市场" : "All Markets") : marketTypeText(item as MarketOpportunity["marketType"], locale)}
            </FilterLink>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.length ? filtered.map((opportunity: MarketOpportunity) => (
            <OpportunityCard
              key={`${opportunity.marketSlug}-${opportunity.outcomeName}-${opportunity.side}`}
              opportunity={opportunity}
              locale={locale}
            />
          )) : (
            <div className="rounded-lg border border-line bg-panel p-5 text-sm text-zinc-500 lg:col-span-2">
              {locale === "zh" ? "当前筛选下暂无机会。可以切换到全部层级，或等待下一次数据刷新。" : "No opportunities match this filter. Try all tiers or wait for the next data refresh."}
            </div>
          )}
        </div>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}

function FilterLink({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-zinc-500 bg-zinc-800 text-zinc-100"
          : "border-line bg-panel text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}

function signalLabel(signal: string, locale: "zh" | "en") {
  const labels: Record<string, { zh: string; en: string }> = {
    all: { zh: "全部", en: "All" },
    strong_edge: { zh: "Strong", en: "Strong" },
    watchlist: { zh: "Watchlist", en: "Watchlist" },
    overheated: { zh: "Overheated", en: "Overheated" },
    basket: { zh: "Basket", en: "Basket" },
    mild_edge: { zh: "Mild", en: "Mild" }
  };
  return locale === "zh" ? labels[signal]?.zh ?? signal : labels[signal]?.en ?? signal;
}

function trustLabel(trust: string, locale: "zh" | "en") {
  if (trust === "all") return locale === "zh" ? "全部层级" : "All Tiers";
  return trustTierText(trust as Exclude<(typeof trustFilters)[number], "all">, locale);
}
