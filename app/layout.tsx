import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "CupEdge",
  description: "Polymarket 世界杯概率错配雷达。"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-ink text-zinc-100">
          <header className="border-b border-line bg-ink/95">
            <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
              <Link href="/" className="font-mono text-base font-semibold tracking-wide text-zinc-100">
                CupEdge
              </Link>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-zinc-400">
                <Link href="/opportunities" className="transition hover:text-zinc-100">
                  {t.nav.opportunities}
                </Link>
                <Link href="/markets" className="transition hover:text-zinc-100">
                  {t.nav.markets}
                </Link>
                <Link href="/moves" className="transition hover:text-zinc-100">
                  {t.nav.moves}
                </Link>
                <Link href="/methodology" className="transition hover:text-zinc-100">
                  {t.nav.methodology}
                </Link>
                <LanguageSwitcher locale={locale} />
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
