"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { Prose } from "@/components/ui/Prose";
import { DrillRunner, type DrillResult } from "@/components/drill/DrillRunner";
import { answerText } from "@/lib/grading";
import { cn, formatDuration } from "@/lib/utils";

const TRACKS = [
  { slug: "javascript", name: "JavaScript" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "react", name: "React" },
  { slug: "node", name: "Node & APIs" },
  { slug: "csharp", name: "C#" },
  { slug: "dotnet", name: "ASP.NET Core & EF" },
  { slug: "fundamentals", name: "Web Fundamentals" },
];

const LENGTHS = [
  { size: 10, label: "Quick screen", time: "~8 min" },
  { size: 20, label: "Phone screen", time: "~15 min" },
  { size: 30, label: "Full round", time: "~25 min" },
];

type Phase = "setup" | "running" | "report";

function Interview() {
  const params = useSearchParams();
  const preselected = (params.get("tracks") ?? "").split(",").filter(Boolean);

  const [phase, setPhase] = useState<Phase>("setup");
  const [selected, setSelected] = useState<string[]>(preselected);
  const [size, setSize] = useState(20);
  const [results, setResults] = useState<DrillResult[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const toggleTrack = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const finish = useCallback(
    async (finalResults: DrillResult[], seconds: number) => {
      setResults(finalResults);
      setElapsed(seconds);
      setPhase("report");

      const correct = finalResults.filter((r) => r.verdict === "correct").length;
      const breakdown: Record<string, { total: number; correct: number }> = {};
      for (const result of finalResults) {
        for (const tag of result.item.tags) {
          breakdown[tag] ??= { total: 0, correct: 0 };
          breakdown[tag].total++;
          if (result.verdict === "correct") breakdown[tag].correct++;
        }
      }

      try {
        await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackSlugs: selected,
            total: finalResults.length,
            correct,
            durationSeconds: seconds,
            breakdown,
          }),
        });
      } catch {
        // The report is on screen either way — a failed write only costs the
        // history entry on the dashboard.
      }
    },
    [selected]
  );

  if (phase === "running") {
    return (
      <DrillRunner
        mode="interview"
        size={size}
        trackSlug={selected.length > 0 ? selected.join(",") : undefined}
        deferFeedback
        onComplete={finish}
        title="Mock interview"
      />
    );
  }

  if (phase === "report") {
    return (
      <Report
        results={results}
        elapsed={elapsed}
        onRetry={() => {
          setResults([]);
          setPhase("setup");
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Mock interview</h1>
        <p className="text-sm ink-muted mt-1 leading-relaxed">
          Rapid-fire questions weighted towards what actually gets asked, with no explanations until
          the end — so you find out what you know rather than reading along. You get a report card
          showing which topics let you down.
        </p>
      </header>

      <Card>
        <p className="text-xs font-medium ink-muted mb-3">
          Tracks {selected.length === 0 && <span className="font-normal">— all of them</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {TRACKS.map((track) => {
            const active = selected.includes(track.slug);
            return (
              <button
                key={track.slug}
                type="button"
                onClick={() => toggleTrack(track.slug)}
                aria-pressed={active}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs transition-colors",
                  active
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 font-medium"
                    : "hairline hover:bg-[var(--surface-muted)]"
                )}
              >
                {track.name}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-medium ink-muted mb-3">Length</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {LENGTHS.map((length) => (
            <button
              key={length.size}
              type="button"
              onClick={() => setSize(length.size)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                size === length.size
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                  : "hairline hover:bg-[var(--surface-muted)]"
              )}
            >
              <p className="text-sm font-medium">{length.label}</p>
              <p className="text-[11px] ink-muted mt-0.5">
                {length.size} questions · {length.time}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Button size="lg" className="w-full" onClick={() => setPhase("running")}>
        Begin
      </Button>
    </div>
  );
}

// ─── report card ───

function Report({
  results,
  elapsed,
  onRetry,
}: {
  results: DrillResult[];
  elapsed: number;
  onRetry: () => void;
}) {
  const correct = results.filter((r) => r.verdict === "correct").length;
  const score = results.length === 0 ? 0 : correct / results.length;
  const missed = results.filter((r) => r.verdict !== "correct");

  const tagStats = new Map<string, { total: number; correct: number }>();
  for (const result of results) {
    for (const tag of result.item.tags) {
      const entry = tagStats.get(tag) ?? { total: 0, correct: 0 };
      entry.total++;
      if (result.verdict === "correct") entry.correct++;
      tagStats.set(tag, entry);
    }
  }

  const weakest = [...tagStats.entries()]
    .filter(([, s]) => s.correct < s.total)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
    .slice(0, 6);

  const verdict =
    score >= 0.85
      ? "You'd come across as solid mid-level on this material."
      : score >= 0.65
        ? "Broadly there, with a few gaps that would show under follow-up questions."
        : "There's real ground to cover here — the good news is you now know exactly where.";

  return (
    <div className="space-y-5">
      <Card padding="lg" className="text-center space-y-4">
        <div>
          <p className="text-5xl font-semibold tabular-nums">{Math.round(score * 100)}%</p>
          <p className="text-sm ink-muted mt-1.5">
            {correct} of {results.length} correct in {formatDuration(elapsed)}
          </p>
        </div>
        <ProgressBar
          value={score}
          className="max-w-xs mx-auto h-2"
          barClassName={score >= 0.85 ? "bg-emerald-500" : score >= 0.65 ? "bg-amber-500" : "bg-rose-500"}
        />
        <p className="text-sm ink-muted max-w-md mx-auto">{verdict}</p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button onClick={onRetry}>New interview</Button>
          <Link href="/drill?mode=weak">
            <Button variant="secondary">Drill the gaps</Button>
          </Link>
        </div>
      </Card>

      {weakest.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-1">Topics that let you down</h2>
          <p className="text-xs ink-muted mb-3">
            These are the follow-up questions you&apos;d struggle with.
          </p>
          <div className="space-y-2.5">
            {weakest.map(([tag, stat]) => (
              <div key={tag} className="flex items-center gap-3 text-xs">
                <span className="w-36 shrink-0 truncate">{tag}</span>
                <ProgressBar
                  value={stat.correct / stat.total}
                  className="flex-1"
                  barClassName={stat.correct === 0 ? "bg-rose-500" : "bg-amber-500"}
                />
                <span className="ink-muted tabular-nums w-9 text-right">
                  {stat.correct}/{stat.total}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {missed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Everything you missed, with the answers</h2>
          {missed.map((result) => (
            <Card key={result.item.id} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{result.item.trackName}</Badge>
                <span className="text-[11px] ink-muted">{result.item.moduleName}</span>
              </div>

              <p className="text-sm font-medium whitespace-pre-wrap">{result.item.prompt}</p>

              <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                  Answer
                </p>
                <pre className="snippet whitespace-pre-wrap">{answerText(result.item)}</pre>
              </div>

              <Prose text={result.item.explanation} language={result.item.language} />

              <Link
                href={`/learn/${result.item.trackSlug}/${result.item.moduleSlug}`}
                className="inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Study {result.item.moduleName} →
              </Link>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <Interview />
    </Suspense>
  );
}
