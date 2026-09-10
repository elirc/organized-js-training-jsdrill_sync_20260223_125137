"use client";

import { Badge, Button, Kbd } from "@/components/ui";
import { Prose } from "@/components/ui/Prose";
import { cn } from "@/lib/utils";
import type { DrillItem, Grade, Rating } from "@/types";

/**
 * Shown after an answer is submitted. This is where the actual learning
 * happens, so the explanation gets more room than the question did — and the
 * interviewer's follow-up is included, because "can you go one level deeper?"
 * is what really decides a screen.
 */
export function Feedback({
  item,
  grade,
  onNext,
  onSelfRate,
  isLast,
  saved,
  onToggleSave,
}: {
  item: DrillItem;
  grade: Grade;
  onNext: () => void;
  /** explain items are scored by the learner. */
  onSelfRate?: (rating: Rating) => void;
  isLast: boolean;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const tone =
    grade.verdict === "correct"
      ? { badge: "success" as const, label: "Correct", bar: "bg-emerald-500" }
      : grade.verdict === "partial"
        ? { badge: "warning" as const, label: "Partly right", bar: "bg-amber-500" }
        : { badge: "error" as const, label: "Not quite", bar: "bg-rose-500" };

  const needsSelfRating = item.type === "explain" && Boolean(onSelfRate);

  return (
    <div className="space-y-5">
      <div className={cn("h-0.5 rounded-full", tone.bar)} />

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={tone.badge}>{tone.label}</Badge>
        <span className="text-xs ink-muted">{grade.message}</span>
        <button
          type="button"
          onClick={onToggleSave}
          className="ml-auto text-xs ink-muted hover:text-[var(--ink)] transition-colors"
          aria-pressed={saved}
        >
          {saved ? "★ Saved" : "☆ Save for later"}
        </button>
      </div>

      {needsSelfRating && item.modelAnswer && (
        <section>
          <h4 className="text-[11px] font-medium uppercase tracking-wide ink-muted mb-2">
            A strong answer
          </h4>
          <div className="rounded-lg border hairline bg-[var(--surface-muted)] p-4">
            <Prose text={item.modelAnswer} />
          </div>
        </section>
      )}

      {item.explanation && (
        <section>
          <h4 className="text-[11px] font-medium uppercase tracking-wide ink-muted mb-2">
            Why
          </h4>
          <Prose text={item.explanation} language={item.language} />
        </section>
      )}

      {item.followUp && (
        <section className="rounded-lg border-l-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10 pl-4 pr-3 py-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
            They&apos;ll ask next
          </h4>
          <p className="text-sm leading-relaxed">{item.followUp}</p>
        </section>
      )}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {needsSelfRating ? (
        <SelfRating onRate={(rating) => onSelfRate?.(rating)} />
      ) : (
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={onNext} size="lg">
            {isLast ? "Finish session" : "Next"}
          </Button>
          <span className="text-xs ink-muted flex items-center gap-1.5">
            or press <Kbd>↵</Kbd>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * FSRS ratings, phrased as a question about recall rather than as
 * Again/Hard/Good/Easy — most people have no idea what "Hard" is supposed to
 * mean the first time they see it.
 */
function SelfRating({ onRate }: { onRate: (rating: Rating) => void }) {
  const options: { rating: Rating; label: string; hint: string; className: string }[] = [
    {
      rating: 1,
      label: "Couldn't answer",
      hint: "Show me again soon",
      className: "hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10",
    },
    {
      rating: 2,
      label: "Missed a lot",
      hint: "Shaky",
      className: "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10",
    },
    {
      rating: 3,
      label: "Covered the main points",
      hint: "Solid",
      className: "hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
    },
    {
      rating: 4,
      label: "Could say this in an interview",
      hint: "Fluent",
      className: "hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10",
    },
  ];

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs ink-muted">How did that go? This sets when you&apos;ll see it again.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={() => onRate(option.rating)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border hairline p-2.5 text-left transition-colors",
              option.className
            )}
          >
            <Kbd>{option.rating}</Kbd>
            <span className="min-w-0">
              <span className="block text-sm">{option.label}</span>
              <span className="block text-[11px] ink-muted">{option.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
