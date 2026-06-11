import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Confidence, TeamStatus } from "@/lib/types/valuation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function percent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

export function signedPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function statusLabel(status: TeamStatus | string) {
  const labels: Record<string, string> = {
    undervalued: "Undervalued",
    slightly_undervalued: "Slightly Undervalued",
    fair: "Fair",
    slightly_overvalued: "Slightly Overvalued",
    overvalued: "Overvalued"
  };
  return labels[status] ?? status;
}

export function confidenceLabel(confidence: Confidence | string) {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export function statusClasses(status: TeamStatus | string) {
  if (status.includes("undervalued")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status.includes("overvalued")) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-300";
}

export function edgeTextClasses(value: number) {
  if (value >= 0.02) return "text-emerald-300";
  if (value <= -0.02) return "text-red-300";
  return "text-zinc-300";
}

export function confidenceClasses(confidence: Confidence | string) {
  if (confidence === "high") return "text-emerald-300";
  if (confidence === "medium") return "text-zinc-200";
  return "text-zinc-500";
}

export function sortValue<T>(value: T) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLowerCase();
  return value;
}
