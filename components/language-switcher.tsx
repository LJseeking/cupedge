"use client";

import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const router = useRouter();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="inline-flex h-8 rounded border border-line bg-panel p-0.5 text-xs">
      {(["zh", "en"] as Locale[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          className={cn(
            "rounded px-2.5 font-medium transition",
            locale === item ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-100"
          )}
          aria-pressed={locale === item}
        >
          {item === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
