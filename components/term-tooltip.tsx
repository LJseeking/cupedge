import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TermTooltip({
  term,
  description,
  align = "left",
  className
}: {
  term: ReactNode;
  description: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex items-center gap-1.5", className)}>
      <span>{term}</span>
      <span
        tabIndex={0}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-zinc-600 outline-none transition hover:text-zinc-300 focus:text-zinc-300"
        aria-label={typeof term === "string" ? `${term} explanation` : "Term explanation"}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "pointer-events-none absolute top-[calc(100%+8px)] z-30 hidden w-64 rounded border border-line bg-zinc-950 p-3 text-left text-xs normal-case leading-5 tracking-normal text-zinc-300 shadow-2xl shadow-black/40 group-hover:block group-focus-within:block",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        {description}
      </span>
    </span>
  );
}
