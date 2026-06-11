"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfidenceText, StatusBadge } from "@/components/status-badge";
import {
  DEFAULT_LOCALE,
  getDictionary,
  marketSignalStrength,
  marketSignalStrengthLabel,
  type Locale
} from "@/lib/i18n";
import type { ValuationRow } from "@/lib/types/valuation";
import { edgeTextClasses, percent, signedPercent } from "@/lib/utils";

type ClientValuation = Omit<ValuationRow, "updatedAt"> & { updatedAt: string };
type SortKey =
  | "name"
  | "polymarketProbability"
  | "bookmakerProbability"
  | "fairProbability"
  | "edgeScore"
  | "status"
  | "confidence"
  | "signalStrength"
  | "updatedAt";

export function ValuationTable({
  rows,
  locale = DEFAULT_LOCALE
}: {
  rows: ClientValuation[];
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const columns: Array<{ key: SortKey; label: string; align?: "right" | "left" }> = [
    { key: "name", label: t.table.team },
    { key: "polymarketProbability", label: t.table.polymarket, align: "right" },
    { key: "bookmakerProbability", label: t.table.bookmaker, align: "right" },
    { key: "fairProbability", label: t.table.fair, align: "right" },
    { key: "edgeScore", label: t.table.edge, align: "right" },
    { key: "status", label: t.table.status },
    { key: "confidence", label: t.table.confidence },
    { key: "signalStrength", label: t.table.signalStrength },
    { key: "updatedAt", label: t.table.updated, align: "right" }
  ];
  const [sortKey, setSortKey] = useState<SortKey>("edgeScore");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aValue = sortableValue(a, sortKey);
      const bValue = sortableValue(b, sortKey);
      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [rows, sortKey, direction]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(
      key === "name" || key === "status" || key === "confidence" || key === "signalStrength"
        ? "asc"
        : "desc"
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="min-w-[960px] w-full border-collapse text-sm">
        <thead className="border-b border-line bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left font-medium">
                <button
                  type="button"
                  onClick={() => handleSort(column.key)}
                  className={`inline-flex w-full items-center gap-2 ${
                    column.align === "right" ? "justify-end" : "justify-start"
                  } transition hover:text-zinc-200`}
                >
                  {column.label}
                  <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sortedRows.map((row) => (
            <tr key={row.slug} className="transition hover:bg-zinc-900/70">
              <td className="whitespace-nowrap px-4 py-3">
                <Link href={`/teams/${row.slug}`} className="font-medium text-zinc-100 hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                {percent(row.polymarketProbability)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                {percent(row.bookmakerProbability)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                {percent(row.fairProbability)}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${edgeTextClasses(
                  row.edgeScore
                )}`}
              >
                {signedPercent(row.edgeScore)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={row.status} locale={locale} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <ConfidenceText confidence={row.confidence} locale={locale} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                {marketSignalStrengthLabel(marketSignalStrength(row.edgeScore), locale)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-zinc-500">
                {formatDate(row.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortableValue(row: ClientValuation, key: SortKey) {
  if (key === "updatedAt") return Date.parse(row.updatedAt);
  if (key === "signalStrength") return signalStrengthRank(row.edgeScore);
  const value = row[key];
  if (value === null || value === undefined) return Number.NEGATIVE_INFINITY;
  return typeof value === "string" ? value.toLowerCase() : value;
}

function signalStrengthRank(edgeScore: number) {
  const strength = marketSignalStrength(edgeScore);
  if (strength === "strong") return 3;
  if (strength === "watch") return 2;
  if (strength === "slight") return 1;
  return 0;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
