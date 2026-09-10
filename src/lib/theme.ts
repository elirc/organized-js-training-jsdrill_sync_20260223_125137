/**
 * Track accents. Tailwind can't see dynamically-built class names, so every
 * class a track might use is spelled out here as a literal.
 */
export type Accent = "amber" | "sky" | "cyan" | "emerald" | "violet" | "rose" | "slate";

type AccentStyles = {
  text: string;
  bg: string;
  bgSoft: string;
  border: string;
  ring: string;
  gradient: string;
  dot: string;
};

const ACCENTS: Record<Accent, AccentStyles> = {
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-600 hover:bg-amber-700",
    bgSoft: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
    ring: "ring-amber-500/40",
    gradient: "from-amber-500 to-orange-500",
    dot: "bg-amber-500",
  },
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-600 hover:bg-sky-700",
    bgSoft: "bg-sky-50 dark:bg-sky-500/10",
    border: "border-sky-200 dark:border-sky-500/30",
    ring: "ring-sky-500/40",
    gradient: "from-sky-500 to-blue-600",
    dot: "bg-sky-500",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-600 hover:bg-cyan-700",
    bgSoft: "bg-cyan-50 dark:bg-cyan-500/10",
    border: "border-cyan-200 dark:border-cyan-500/30",
    ring: "ring-cyan-500/40",
    gradient: "from-cyan-400 to-teal-500",
    dot: "bg-cyan-500",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-600 hover:bg-emerald-700",
    bgSoft: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
    ring: "ring-emerald-500/40",
    gradient: "from-emerald-500 to-green-600",
    dot: "bg-emerald-500",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-600 hover:bg-violet-700",
    bgSoft: "bg-violet-50 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/30",
    ring: "ring-violet-500/40",
    gradient: "from-violet-500 to-purple-600",
    dot: "bg-violet-500",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-600 hover:bg-rose-700",
    bgSoft: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/30",
    ring: "ring-rose-500/40",
    gradient: "from-rose-500 to-pink-600",
    dot: "bg-rose-500",
  },
  slate: {
    text: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-700 hover:bg-slate-800",
    bgSoft: "bg-slate-100 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/30",
    ring: "ring-slate-500/40",
    gradient: "from-slate-500 to-slate-700",
    dot: "bg-slate-500",
  },
};

export function accent(name: string): AccentStyles {
  return ACCENTS[(name as Accent) in ACCENTS ? (name as Accent) : "slate"];
}

/** Colour for a 0..1 mastery value — grey → amber → green. */
export function masteryColor(mastery: number): string {
  if (mastery <= 0) return "bg-slate-200 dark:bg-slate-700";
  if (mastery < 0.34) return "bg-rose-400 dark:bg-rose-500";
  if (mastery < 0.67) return "bg-amber-400 dark:bg-amber-500";
  return "bg-emerald-500";
}

export function masteryLabel(mastery: number): string {
  if (mastery <= 0) return "Not started";
  if (mastery < 0.34) return "Shaky";
  if (mastery < 0.67) return "Getting there";
  if (mastery < 0.9) return "Solid";
  return "Interview-ready";
}
