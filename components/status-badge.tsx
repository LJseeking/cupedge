import {
  confidenceLabel as translatedConfidenceLabel,
  DEFAULT_LOCALE,
  statusLabel as translatedStatusLabel,
  type Locale
} from "@/lib/i18n";
import type { Confidence, TeamStatus } from "@/lib/types/valuation";
import { statusClasses } from "@/lib/utils";

export function StatusBadge({
  status,
  locale = DEFAULT_LOCALE
}: {
  status: TeamStatus | string;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex min-w-24 items-center justify-center rounded border px-2 py-1 text-xs font-medium ${statusClasses(
        status
      )}`}
    >
      {translatedStatusLabel(status, locale)}
    </span>
  );
}

export function ConfidenceText({
  confidence,
  locale = DEFAULT_LOCALE
}: {
  confidence: Confidence | string;
  locale?: Locale;
}) {
  const className =
    confidence === "high"
      ? "text-emerald-300"
      : confidence === "medium"
        ? "text-zinc-200"
        : "text-zinc-500";

  return <span className={className}>{translatedConfidenceLabel(confidence, locale)}</span>;
}
