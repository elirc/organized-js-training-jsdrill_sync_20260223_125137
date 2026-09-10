"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Kbd, ProgressBar } from "@/components/ui";
import { ChoiceView, ExplainView, FillView, ItemPrompt, OrderView, PredictView } from "./ItemViews";
import { CodeView } from "./CodeView";
import { Feedback } from "./Feedback";
import { grade as gradeItem, gradeCode } from "@/lib/grading";
import { runCode } from "@/lib/executor";
import { accent } from "@/lib/theme";
import { cn, formatTime } from "@/lib/utils";
import type {
  DrillItem,
  DrillSession,
  ExecutionResult,
  Grade,
  Rating,
  Response,
  SessionMode,
} from "@/types";

export type DrillResult = {
  item: DrillItem;
  verdict: Grade["verdict"];
  score: number;
  timeSpent: number;
};

type Props = {
  mode: SessionMode;
  size?: number;
  moduleSlug?: string;
  trackSlug?: string;
  /** Interview mode hides explanations until the end and runs one clock. */
  deferFeedback?: boolean;
  onComplete?: (results: DrillResult[], elapsedSeconds: number) => void;
  title?: string;
};

export function DrillRunner({
  mode,
  size = 12,
  moduleSlug,
  trackSlug,
  deferFeedback = false,
  onComplete,
  title,
}: Props) {
  const [session, setSession] = useState<DrillSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<Response | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DrillResult[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  const itemStart = useRef(Date.now());
  const sessionStart = useRef(Date.now());

  const item = session?.items[index] ?? null;
  const isLast = session ? index === session.items.length - 1 : false;

  // ─── load ───

  const load = useCallback(async () => {
    setLoading(true);
    setFinished(false);
    setResults([]);
    setIndex(0);
    setResponse(null);
    setGrade(null);
    setExecution(null);
    setElapsed(0);

    const params = new URLSearchParams({ mode, size: String(size) });
    if (moduleSlug) params.set("module", moduleSlug);
    if (trackSlug) params.set("track", trackSlug);

    try {
      const res = await fetch(`/api/session?${params}`);
      const json = await res.json();
      if (json.success) setSession(json.data);
      else setSession({ items: [], meta: { mode, reviewCount: 0, newCount: 0, label: "" } });
    } catch {
      setSession({ items: [], meta: { mode, reviewCount: 0, newCount: 0, label: "" } });
    }

    itemStart.current = Date.now();
    sessionStart.current = Date.now();
    setLoading(false);
  }, [mode, size, moduleSlug, trackSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // One clock for the whole session; the per-item time is measured separately
  // because that's what feeds the difficulty rating.
  useEffect(() => {
    if (loading || finished) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loading, finished]);

  // ─── answering ───

  const record = useCallback(
    async (current: DrillItem, finalGrade: Grade, answer: Response, timeSpent: number) => {
      setResults((prev) => [
        ...prev,
        { item: current, verdict: finalGrade.verdict, score: finalGrade.score, timeSpent },
      ]);

      try {
        await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: current.id,
            response: answer,
            timeSpent,
            verdict: finalGrade.verdict,
            score: finalGrade.score,
          }),
        });
      } catch {
        // A failed write shouldn't interrupt the drill — the answer is already
        // on screen and the schedule can catch up next session.
      }
    },
    []
  );

  const submit = useCallback(() => {
    if (!item || grade) return;
    if (item.type === "code") return; // handled by runTests

    if (item.type === "explain") {
      // Answering out loud and writing nothing down is a legitimate way to use
      // these, so an empty response still reveals the model answer. Score the
      // keywords now and wait for the self-rating before recording.
      const answer: Response = response ?? { kind: "text", text: "" };
      setGrade(gradeItem(item, answer));
      return;
    }

    if (!response) return;

    const result = gradeItem(item, response);
    setGrade(result);
    void record(item, result, response, Math.round((Date.now() - itemStart.current) / 1000));
  }, [item, grade, response, record]);

  const runTests = useCallback(async () => {
    if (!item || grade || running) return;
    const code = response?.kind === "code" ? response.code : item.starterCode;

    setRunning(true);
    const result = await runCode(code, item.testCases);
    setExecution(result);
    setRunning(false);

    if (result.allPassed) {
      const finalGrade = gradeCode(result.results);
      setGrade(finalGrade);
      void record(
        item,
        finalGrade,
        { kind: "code", code },
        Math.round((Date.now() - itemStart.current) / 1000)
      );
    }
  }, [item, grade, running, response, record]);

  /** code items: give up and see the solution. */
  const revealCode = useCallback(() => {
    if (!item || grade) return;
    const code = response?.kind === "code" ? response.code : item.starterCode;
    const finalGrade = gradeCode(execution?.results ?? []);
    setGrade({ ...finalGrade, verdict: "incorrect", score: 0, message: "Marked as not solved." });
    void record(
      item,
      { ...finalGrade, verdict: "incorrect", score: 0 },
      { kind: "code", code },
      Math.round((Date.now() - itemStart.current) / 1000)
    );
  }, [item, grade, response, execution, record]);

  const selfRate = useCallback(
    (rating: Rating) => {
      if (!item || !grade) return;
      const text = response?.kind === "text" ? response.text : "";
      const answer: Response = { kind: "selfRated", text, rating };
      const finalGrade = gradeItem(item, answer);
      setGrade(finalGrade);
      void record(item, finalGrade, answer, Math.round((Date.now() - itemStart.current) / 1000));
      advance();
    },
    // advance is stable enough for this call site; see the definition below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, grade, response, record]
  );

  const advance = useCallback(() => {
    if (!session) return;
    if (index >= session.items.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setResponse(null);
    setGrade(null);
    setExecution(null);
    itemStart.current = Date.now();
  }, [session, index]);

  useEffect(() => {
    if (!finished || !onComplete) return;
    onComplete(results, Math.floor((Date.now() - sessionStart.current) / 1000));
    // Fire once when the session ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const toggleSave = useCallback(async () => {
    if (!item) return;
    const next = new Set(saved);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    setSaved(next);
    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
    } catch {
      setSaved(saved); // put it back if the write failed
    }
  }, [item, saved]);

  // ─── keyboard ───

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName);

      if (e.key === "Enter" && !e.shiftKey) {
        if (grade && item?.type !== "explain") {
          e.preventDefault();
          advance();
        } else if (!grade && !typing && (response || item?.type === "explain")) {
          e.preventDefault();
          submit();
        }
      }

      // Self-rating shortcuts on the explain feedback screen.
      if (grade && item?.type === "explain" && !typing && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        selfRate(Number(e.key) as Rating);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [grade, response, item, advance, submit, selfRate]);

  // ─── render ───

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm ink-muted">Building your session…</p>
        </div>
      </div>
    );
  }

  if (!session || session.items.length === 0) {
    return (
      <EmptyState
        icon="🗂"
        title="Nothing to practise here yet"
        body="No questions matched this selection. Seed the content database with npm run db:seed, or try a different track."
        action={
          <Button onClick={load} variant="secondary">
            Try again
          </Button>
        }
      />
    );
  }

  if (finished) {
    return <SessionSummary results={results} elapsed={elapsed} onRestart={load} />;
  }

  if (!item) return null;

  const tone = accent(item.trackAccent);
  const canSubmit = (Boolean(response) || item.type === "explain") && !grade;
  const showFeedback = Boolean(grade) && !deferFeedback;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("h-2 w-2 rounded-full shrink-0", tone.dot)} />
            <span className="truncate">
              <span className="font-medium">{item.trackName}</span>
              <span className="ink-muted"> · {item.moduleName}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ink-muted">
            <span>{formatTime(elapsed)}</span>
            <span>
              {index + 1}/{session.items.length}
            </span>
          </div>
        </div>
        <ProgressBar
          value={(index + (grade ? 1 : 0)) / session.items.length}
          barClassName={cn("bg-gradient-to-r", tone.gradient)}
        />
      </div>

      <Card padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{typeLabel(item.type)}</Badge>
          {item.isReview && <Badge variant="info">Review</Badge>}
          {item.frequency === 3 && <Badge variant="warning">Asked often</Badge>}
          {title && <span className="text-xs ink-muted ml-auto">{title}</span>}
        </div>

        <ItemPrompt item={item} />

        <div className="pt-1">
          {(item.type === "mcq" || item.type === "multi") && (
            <ChoiceView
              item={item}
              response={response}
              onChange={setResponse}
              onSubmit={submit}
              grade={grade}
            />
          )}
          {item.type === "predict" && (
            <PredictView
              item={item}
              response={response}
              onChange={setResponse}
              onSubmit={submit}
              grade={grade}
            />
          )}
          {item.type === "fill" && (
            <FillView
              item={item}
              response={response}
              onChange={setResponse}
              onSubmit={submit}
              grade={grade}
            />
          )}
          {item.type === "order" && (
            <OrderView
              item={item}
              response={response}
              onChange={setResponse}
              onSubmit={submit}
              grade={grade}
            />
          )}
          {item.type === "explain" && (
            <ExplainView
              item={item}
              response={response}
              onChange={setResponse}
              onSubmit={submit}
              grade={grade}
            />
          )}
          {item.type === "code" && (
            <CodeView
              item={item}
              response={response}
              onChange={setResponse}
              onRun={runTests}
              running={running}
              execution={execution}
              grade={grade}
            />
          )}
        </div>

        {!grade && item.type !== "code" && (
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={submit} disabled={!canSubmit} size="lg">
              Check answer
            </Button>
            <span className="text-xs ink-muted flex items-center gap-1.5">
              <Kbd>↵</Kbd>
            </span>
          </div>
        )}

        {!grade && item.type === "code" && execution && !execution.allPassed && (
          <button
            type="button"
            onClick={revealCode}
            className="text-xs ink-muted hover:text-[var(--ink)] transition-colors"
          >
            Give up and see the answer
          </button>
        )}

        {showFeedback && grade && (
          <div className="pt-2 border-t hairline">
            <Feedback
              item={item}
              grade={grade}
              onNext={advance}
              onSelfRate={item.type === "explain" ? selfRate : undefined}
              isLast={isLast}
              saved={saved.has(item.id)}
              onToggleSave={toggleSave}
            />
          </div>
        )}

        {grade && deferFeedback && (
          <div className="pt-2 border-t hairline flex items-center gap-3">
            <Button onClick={advance} size="lg">
              {isLast ? "See results" : "Next question"}
            </Button>
            <span className="text-xs ink-muted">Answers are revealed at the end</span>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── summary ───

function SessionSummary({
  results,
  elapsed,
  onRestart,
}: {
  results: DrillResult[];
  elapsed: number;
  onRestart: () => void;
}) {
  const correct = results.filter((r) => r.verdict === "correct").length;
  const accuracy = results.length === 0 ? 0 : correct / results.length;
  const missed = results.filter((r) => r.verdict !== "correct");

  const byTrack = useMemo(() => {
    const map = new Map<string, { name: string; total: number; correct: number }>();
    for (const r of results) {
      const entry = map.get(r.item.trackSlug) ?? { name: r.item.trackName, total: 0, correct: 0 };
      entry.total++;
      if (r.verdict === "correct") entry.correct++;
      map.set(r.item.trackSlug, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [results]);

  return (
    <div className="space-y-4">
      <Card padding="lg" className="text-center space-y-4">
        <div>
          <p className="text-4xl font-semibold tabular-nums">
            {correct}
            <span className="ink-muted text-2xl">/{results.length}</span>
          </p>
          <p className="text-sm ink-muted mt-1">
            {Math.round(accuracy * 100)}% in {formatTime(elapsed)}
          </p>
        </div>

        <ProgressBar
          value={accuracy}
          className="max-w-xs mx-auto"
          barClassName={accuracy >= 0.8 ? "bg-emerald-500" : accuracy >= 0.5 ? "bg-amber-500" : "bg-rose-500"}
        />

        <p className="text-sm ink-muted max-w-md mx-auto">
          {accuracy >= 0.9
            ? "That's interview-ready on this material. The items you got right will come back less often."
            : accuracy >= 0.6
              ? "Solid. The ones you missed are already scheduled to come back sooner."
              : "This material needs another pass — that's exactly what the scheduler is for."}
        </p>

        <div className="flex items-center justify-center gap-3 pt-1">
          <Button onClick={onRestart}>Another session</Button>
          <Link href="/dashboard">
            <Button variant="secondary">View progress</Button>
          </Link>
        </div>
      </Card>

      {byTrack.length > 1 && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">By track</h3>
          <div className="space-y-2.5">
            {byTrack.map((track) => (
              <div key={track.name} className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0 truncate">{track.name}</span>
                <ProgressBar value={track.correct / track.total} className="flex-1" />
                <span className="ink-muted tabular-nums w-10 text-right">
                  {track.correct}/{track.total}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {missed.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-1">Worth another look</h3>
          <p className="text-xs ink-muted mb-3">
            These are back in the queue. Their tags are where your weak spots come from.
          </p>
          <ul className="space-y-2">
            {missed.map((r) => (
              <li key={r.item.id} className="text-xs flex items-start gap-2">
                <span className="ink-muted shrink-0">·</span>
                <span>
                  {r.item.prompt.split("\n")[0].slice(0, 110)}
                  {r.item.tags.length > 0 && (
                    <span className="ink-muted"> — {r.item.tags.join(", ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function typeLabel(type: DrillItem["type"]): string {
  return {
    mcq: "Multiple choice",
    multi: "Select all",
    predict: "Predict the output",
    fill: "Fill the blanks",
    order: "Put in order",
    code: "Write the code",
    explain: "Explain it",
  }[type];
}
