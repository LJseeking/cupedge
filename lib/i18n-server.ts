import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const locale = store.get(LOCALE_COOKIE)?.value;
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
