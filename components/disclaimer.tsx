import { DEFAULT_LOCALE, getDictionary, type Locale } from "@/lib/i18n";

export function Disclaimer({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = getDictionary(locale);

  return (
    <footer className="mx-auto max-w-7xl px-4 pb-8 pt-10 text-xs leading-5 text-zinc-500 sm:px-6 lg:px-8">
      <p>{t.disclaimer.primary}</p>
      <p className="mt-2">{t.disclaimer.secondary}</p>
    </footer>
  );
}
