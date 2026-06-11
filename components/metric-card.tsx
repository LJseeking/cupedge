import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={cn(
          "mt-3 font-mono text-2xl font-semibold",
          tone === "positive" && "text-emerald-300",
          tone === "negative" && "text-red-300",
          tone === "neutral" && "text-zinc-100"
        )}
      >
        {value}
      </div>
    </div>
  );
}
