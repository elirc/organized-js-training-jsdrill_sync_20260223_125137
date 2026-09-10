"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { DrillRunner } from "@/components/drill/DrillRunner";
import { cn } from "@/lib/utils";
import type { SessionMode } from "@/types";

const MODES: SessionMode[] = ["mixed", "module", "track", "weak"];

const MODE_OPTIONS: { mode: SessionMode; title: string; body: string }[] = [
  {
    mode: "mixed",
    title: "Daily mix",
    body: "Everything that's due, topped up with new material from where you are on the roadmap. The default, and the one that actually moves you forward.",
  },
  {
    mode: "weak",
    title: "Weak spots",
    body: "Drills only the tags you keep getting wrong. Needs a bit of history first — three attempts on a topic before it counts as a weakness.",
  },
];

const SIZES = [8, 12, 20, 30];

function Drill() {
  const params = useSearchParams();

  const rawMode = params.get("mode");
  const preset = rawMode && (MODES as string[]).includes(rawMode) ? (rawMode as SessionMode) : null;
  const moduleSlug = params.get("module") ?? undefined;
  const trackSlug = params.get("track") ?? undefined;

  const [mode, setMode] = useState<SessionMode | null>(preset);
  const [size, setSize] = useState(Number.parseInt(params.get("size") ?? "12", 10) || 12);

  // Arriving from a module or track link should start immediately — the choice
  // was already made on the page they came from.
  if (mode) {
    return (
      <DrillRunner mode={mode} size={size} moduleSlug={moduleSlug} trackSlug={trackSlug} />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm ink-muted mt-1">
          Pick a session. Everything is keyboard-driven — number keys select, Enter submits and
          moves on.
        </p>
      </header>

      <div className="space-y-3">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => setMode(option.mode)}
            className="w-full text-left"
          >
            <Card className="hover:border-indigo-400 transition-colors">
              <h2 className="font-medium text-sm mb-1">{option.title}</h2>
              <p className="text-xs ink-muted leading-relaxed">{option.body}</p>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <p className="text-xs font-medium ink-muted mb-2.5">Questions per session</p>
        <div className="flex gap-2">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg border text-sm transition-colors",
                size === option
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 font-medium"
                  : "hairline hover:bg-[var(--surface-muted)]"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Card>

      <Button size="lg" className="w-full" onClick={() => setMode("mixed")}>
        Start daily mix
      </Button>
    </div>
  );
}

export default function DrillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <Drill />
    </Suspense>
  );
}
