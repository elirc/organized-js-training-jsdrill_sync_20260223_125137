"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Button, Kbd, Textarea } from "@/components/ui";
import { letter } from "@/lib/grading";
import { cn } from "@/lib/utils";
import type { DrillItem, Grade, Response } from "@/types";

/**
 * One component per item type. They all share a contract: render the input,
 * report the current answer upward, and grey out once `graded` is set — the
 * runner owns submission and scoring.
 */
export type ViewProps = {
  item: DrillItem;
  response: Response | null;
  onChange: (response: Response) => void;
  onSubmit: () => void;
  grade: Grade | null;
};

// ─── Choice-based (mcq / multi) ───

export function ChoiceView({ item, response, onChange, onSubmit, grade }: ViewProps) {
  const multi = item.type === "multi";
  const selected = useMemo(() => {
    if (response?.kind === "choice") return [response.index];
    if (response?.kind === "choices") return response.indices;
    return [];
  }, [response]);

  const toggle = (index: number) => {
    if (grade) return;
    if (!multi) {
      onChange({ kind: "choice", index });
      return;
    }
    const next = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [...selected, index].sort((a, b) => a - b);
    onChange({ kind: "choices", indices: next });
  };

  // Number keys pick an option; single-choice submits on the second press of
  // the same key, so a confident answer is two taps and no mouse.
  useEffect(() => {
    if (grade) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const index = Number.parseInt(e.key, 10) - 1;
      if (Number.isInteger(index) && index >= 0 && index < item.choices.length) {
        e.preventDefault();
        if (!multi && selected[0] === index) onSubmit();
        else toggle(index);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="space-y-2">
      {multi && (
        <p className="text-xs ink-muted flex items-center gap-2">
          Select all that apply <Kbd>1</Kbd>–<Kbd>{item.choices.length}</Kbd> to toggle
        </p>
      )}
      {item.choices.map((choice, index) => {
        const isSelected = selected.includes(index);
        const isCorrect = grade?.detail[index];

        return (
          <button
            key={index}
            type="button"
            onClick={() => toggle(index)}
            disabled={Boolean(grade)}
            aria-pressed={isSelected}
            className={cn(
              "w-full flex items-start gap-3 text-left rounded-lg border p-3 transition-colors",
              "disabled:cursor-default",
              !grade && isSelected && "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10",
              !grade && !isSelected && "hairline hover:bg-[var(--surface-muted)]",
              grade && isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
              grade && !isCorrect && isSelected && "border-rose-500 bg-rose-50 dark:bg-rose-500/10",
              grade && !isCorrect && !isSelected && "hairline opacity-55"
            )}
          >
            <span
              className={cn(
                "shrink-0 w-6 h-6 rounded flex items-center justify-center text-[11px] font-semibold border",
                isSelected ? "border-transparent bg-indigo-600 text-white" : "hairline ink-muted"
              )}
            >
              {letter(index)}
            </span>
            <span className="text-sm leading-relaxed pt-0.5">{choice}</span>
            {grade && isCorrect && <span className="ml-auto text-emerald-600 text-sm">✓</span>}
            {grade && !isCorrect && isSelected && (
              <span className="ml-auto text-rose-600 text-sm">✕</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Predict output ───

export function PredictView({ item, response, onChange, onSubmit, grade }: ViewProps) {
  const value = response?.kind === "text" ? response.text : "";
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!grade) ref.current?.focus();
  }, [grade, item.id]);

  return (
    <div className="space-y-3">
      <Textarea
        ref={ref}
        label="Your answer"
        rows={3}
        spellCheck={false}
        value={value}
        disabled={Boolean(grade)}
        placeholder="One value per line, as it would appear"
        className="snippet"
        onChange={(e) => onChange({ kind: "text", text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {!grade && (
        <p className="text-xs ink-muted flex items-center gap-1.5">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
          to check. Whitespace and quote style are ignored.
        </p>
      )}
      {grade && grade.verdict !== "correct" && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1.5">
            Expected
          </p>
          <pre className="snippet whitespace-pre-wrap">{String(item.answer ?? "")}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Fill in the blanks ───

export function FillView({ item, response, onChange, onSubmit, grade }: ViewProps) {
  const expected = (item.answer as string[]) ?? [];
  const blanks = response?.kind === "blanks" ? response.blanks : [];

  // Split the snippet on runs of underscores so each blank becomes an input
  // sitting inline in the code.
  const segments = useMemo(() => item.code.split(/(_{2,})/g), [item.code]);
  let blankIndex = -1;

  const update = (index: number, text: string) => {
    const next = [...blanks];
    while (next.length < expected.length) next.push("");
    next[index] = text;
    onChange({ kind: "blanks", blanks: next });
  };

  return (
    <div className="space-y-3">
      <pre className="snippet overflow-x-auto rounded-lg border hairline bg-[var(--surface-muted)] p-3.5 whitespace-pre-wrap">
        {segments.map((segment, i) => {
          if (!/^_{2,}$/.test(segment)) return <span key={i}>{segment}</span>;
          blankIndex++;
          const index = blankIndex;
          const state = grade?.detail[index];

          return (
            <input
              key={i}
              value={blanks[index] ?? ""}
              disabled={Boolean(grade)}
              spellCheck={false}
              autoComplete="off"
              aria-label={`Blank ${index + 1}`}
              onChange={(e) => update(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              style={{ width: `${Math.max(6, (blanks[index]?.length ?? 0) + 2)}ch` }}
              className={cn(
                "snippet inline-block mx-0.5 px-1.5 py-0.5 rounded border-b-2 bg-[var(--surface)] text-center",
                "focus:outline-none",
                state === undefined && "border-indigo-400 focus:border-indigo-600",
                state === true && "border-emerald-500 text-emerald-700 dark:text-emerald-300",
                state === false && "border-rose-500 text-rose-700 dark:text-rose-300"
              )}
            />
          );
        })}
      </pre>

      {grade && grade.verdict !== "correct" && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-1">
          {expected.map((answer, i) => (
            <p key={i} className="text-xs">
              <span className="ink-muted">Blank {i + 1}:</span>{" "}
              <code className="snippet font-semibold">{answer.split("|")[0]}</code>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ordering ───

export function OrderView({ item, response, onChange, grade }: ViewProps) {
  const order = response?.kind === "order" ? response.order : [];
  const remaining = item.choices.map((_, i) => i).filter((i) => !order.includes(i));

  const pick = (index: number) => {
    if (grade) return;
    onChange({ kind: "order", order: [...order, index] });
  };
  const undo = () => {
    if (grade) return;
    onChange({ kind: "order", order: order.slice(0, -1) });
  };

  const correctOrder = (item.answer as number[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs ink-muted">Click in order — first to last</p>
        {order.length === 0 && (
          <div className="rounded-lg border border-dashed hairline p-4 text-center text-xs ink-muted">
            Your ordering will appear here
          </div>
        )}
        {order.map((choiceIndex, position) => {
          const state = grade?.detail[position];
          return (
            <div
              key={position}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-2.5 text-sm",
                state === undefined && "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
                state === true && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                state === false && "border-rose-500 bg-rose-50 dark:bg-rose-500/10"
              )}
            >
              <span className="shrink-0 w-6 h-6 rounded bg-[var(--surface-muted)] border hairline flex items-center justify-center text-[11px] font-semibold">
                {position + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{item.choices[choiceIndex]}</span>
            </div>
          );
        })}
      </div>

      {!grade && remaining.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs ink-muted">Remaining</p>
            {order.length > 0 && (
              <Button size="sm" variant="ghost" onClick={undo}>
                Undo
              </Button>
            )}
          </div>
          {remaining.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => pick(index)}
              className="w-full text-left rounded-lg border hairline p-2.5 text-sm hover:bg-[var(--surface-muted)] transition-colors"
            >
              {item.choices[index]}
            </button>
          ))}
        </div>
      )}

      {grade && grade.verdict !== "correct" && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
            Correct order
          </p>
          {correctOrder.map((choiceIndex, i) => (
            <p key={i} className="text-xs">
              {i + 1}. {item.choices[choiceIndex]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Explain out loud ───

export function ExplainView({ item, response, onChange, grade }: ViewProps) {
  const value =
    response?.kind === "text" || response?.kind === "selfRated" ? response.text : "";
  const [revealed, setRevealed] = useState(false);
  // Reset when the runner moves to a different item. Adjusting state during
  // render is React's documented alternative to a reset-on-prop-change effect:
  // it re-renders immediately instead of painting the stale value first.
  const [shownFor, setShownFor] = useState(item.id);
  if (shownFor !== item.id) {
    setShownFor(item.id);
    setRevealed(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs ink-muted">
        Say it out loud first, then jot the key points. You&apos;ll rate yourself against the model
        answer.
      </p>
      <Textarea
        rows={5}
        value={value}
        disabled={Boolean(grade)}
        placeholder="The main points I would cover…"
        onChange={(e) => onChange({ kind: "text", text: e.target.value })}
      />

      {!grade && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {revealed ? "Hide" : "Show"} the concepts a good answer covers
        </button>
      )}

      {(revealed || grade) && (
        <div className="flex flex-wrap gap-1.5">
          {item.keywords.map((keyword) => {
            const primary = keyword.split("|")[0];
            const hit = grade?.hits.includes(primary);
            const miss = grade?.misses.includes(primary);
            return (
              <span
                key={keyword}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-medium border",
                  hit && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  miss && "border-rose-400 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
                  !grade && "hairline ink-muted"
                )}
              >
                {hit && "✓ "}
                {miss && "· "}
                {primary}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The prompt header shared by every type. */
export function ItemPrompt({ item }: { item: DrillItem }) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">{item.prompt}</p>
      {item.code && item.type !== "fill" && (
        <CodeBlock code={item.code} language={item.language} />
      )}
    </div>
  );
}
