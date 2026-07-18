import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";

const f = fsrs();

export { Rating, State };

export function createNewCard(): Card {
  return createEmptyCard();
}

export function scheduleNext(
  card: Card,
  passed: boolean,
  timeSpent: number,
  timeLimit: number,
  timedMode: boolean
): { card: Card; rating: Rating } {
  let rating: Rating;

  if (!passed) {
    rating = Rating.Again;
  } else if (timedMode && timeSpent > timeLimit * 0.8) {
    rating = Rating.Hard;
  } else if (timeSpent < timeLimit * 0.4) {
    rating = Rating.Easy;
  } else {
    rating = Rating.Good;
  }

  const scheduling = f.repeat(card, new Date());
  const nextCard = scheduling[rating].card;

  return { card: nextCard, rating };
}

export function cardFromDb(row: {
  stability: number;
  difficulty: number;
  due: string;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
}): Card {
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
  } as Card;
}

export function cardToDb(card: Card) {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) <= new Date();
}
