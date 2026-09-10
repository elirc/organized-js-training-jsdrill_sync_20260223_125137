import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  State,
  type Card,
  type Grade as FsrsGrade,
} from "ts-fsrs";
import type { Rating } from "@/types";

/**
 * Slightly lower retention than the default 0.9: interview prep is broad, and
 * seeing more distinct material beats drilling the same card to perfection.
 */
const scheduler = fsrs(generatorParameters({ request_retention: 0.88, enable_fuzz: true }));

export { State };

export type CardRow = {
  stability: number;
  difficulty: number;
  due: string;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
};

export function newCard(): Card {
  return createEmptyCard();
}

/** Apply a review and return the updated card. */
export function review(card: Card, rating: Rating, at: Date = new Date()): Card {
  // Our Rating (1-4) lines up with ts-fsrs's Grade (Again/Hard/Good/Easy);
  // Manual (0) is deliberately not reachable from the UI.
  return scheduler.next(card, at, rating as FsrsGrade).card;
}

/** How many days until this card is due again, from now. */
export function daysUntilDue(due: string): number {
  const ms = new Date(due).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function cardFromRow(row: CardRow): Card {
  return {
    stability: row.stability,
    difficulty: row.difficulty,
    due: new Date(row.due),
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ? new Date(row.lastReview) : undefined,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
  } as Card;
}

export function cardToRow(card: Card): CardRow {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ? new Date(card.last_review).toISOString() : null,
  };
}

/**
 * How well this item is known, 0..1.
 *
 * Two components. Answering correctly at all is real progress and earns a
 * floor, because a number that barely moves for the first week is a number
 * nobody looks at twice. The rest comes from FSRS stability — roughly "days
 * until recall drops to 90%" — which only grows through successful reviews, so
 * the top of the range has to be earned over time rather than in one sitting.
 *
 * It then fades while a review is overdue, which is what makes the roadmap
 * honest: stop practising and the green goes away, because your recall did too.
 */
export function cardMastery(
  row: Pick<CardRow, "stability" | "reps" | "state" | "due">,
  at: Date = new Date()
): number {
  if (row.reps === 0) return 0;

  // A lapsed card is back in relearning — treat it as barely known again.
  const floor = row.state === State.Relearning ? 0.15 : 0.4;
  const retention = Math.min(row.stability, 30) / 30;
  let mastery = floor + retention * (1 - floor);

  const overdueDays = (at.getTime() - new Date(row.due).getTime()) / 86_400_000;
  if (overdueDays > 0) {
    // Fade over roughly twice the interval the card had earned, and never all
    // the way to zero — you haven't forgotten it completely, you're just due.
    const window = Math.max(row.stability, 1) * 2;
    mastery *= Math.max(0.35, 1 - overdueDays / window);
  }

  return Math.min(1, Math.max(0, mastery));
}

export function isDue(due: string, at: Date = new Date()): boolean {
  return new Date(due).getTime() <= at.getTime();
}
