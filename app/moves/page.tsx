import { Disclaimer } from "@/components/disclaimer";
import { MoveChart } from "@/components/move-chart";
import { MovesTable } from "@/components/moves-table";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getRecentMoves } from "@/lib/services/snapshot";

export const dynamic = "force-dynamic";

export default async function MovesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const moves = await getRecentMoves();

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-line pb-6">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">
            {t.moves.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-500">
            {t.moves.subtitle}
          </p>
        </div>

        <div className="grid gap-5">
          <MoveChart moves={moves} locale={locale} />
          <MovesTable moves={moves} locale={locale} />
        </div>
      </section>
      <Disclaimer locale={locale} />
    </main>
  );
}
