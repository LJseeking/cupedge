import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const tiers = [
  {
    name: "Free",
    description: {
      zh: "适合快速查看今日重点信号。",
      en: "For quickly reviewing the top daily signals."
    },
    features: {
      zh: ["查看每日顶部信号", "基础 Edge Score"],
      en: ["View top daily signals", "Basic edge score"]
    }
  },
  {
    name: "Pro",
    description: {
      zh: "适合需要价格提醒和完整机会列表的个人用户。",
      en: "For users who want alerts and full signal review."
    },
    features: {
      zh: ["价格提醒", "Entry Zone 和失效价", "信号历史", "完整机会列表"],
      en: ["Price alerts", "Entry zone and invalidation price", "Signal history", "Full opportunity list"]
    }
  },
  {
    name: "Team",
    description: {
      zh: "适合团队工作流和自定义市场监控。",
      en: "For team workflows and custom market monitoring."
    },
    features: {
      zh: ["API access", "自定义市场", "多人 dashboard"],
      en: ["API access", "Custom markets", "Multi-user dashboard"]
    }
  }
];

export default async function PricingPage() {
  const locale = await getLocale();

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {locale === "zh" ? "返回首页" : "Back home"}
        </Link>

        <div className="mt-6 border-b border-line pb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {locale === "zh" ? "CupEdge Pro 入口" : "CupEdge Pro Access"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {locale === "zh"
              ? "这是付费功能占位页，当前不接真实支付。CupEdge 仍只提供信息展示和 signal scanner，不提供投资、博彩或交易建议。"
              : "This is a placeholder for paid features. No real payment is connected. CupEdge remains an informational signal scanner, not financial, betting, or trading advice."}
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <section key={tier.name} className="rounded-lg border border-line bg-panel p-5">
              <h2 className="font-mono text-xl font-semibold text-zinc-100">{tier.name}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {tier.description[locale]}
              </p>
              <ul className="mt-5 space-y-3 text-sm text-zinc-300">
                {tier.features[locale].map((feature) => (
                  <li key={feature} className="border-t border-line pt-3">
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-6 w-full rounded border border-line bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-500"
                disabled
              >
                {locale === "zh" ? "暂未开放" : "Coming Soon"}
              </button>
            </section>
          ))}
        </div>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}
