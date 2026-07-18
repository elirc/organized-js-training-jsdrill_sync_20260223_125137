# `src/lib/fsrs.ts` — Spaced Repetition Wrapper

**What this file does:** Wraps the `ts-fsrs` library to provide a clean interface for scheduling problem reviews. It translates between our app's data model (database rows) and FSRS's internal `Card` type.

**Why it matters:** This is the brain of the app's learning system. It decides when a user should see a problem again based on how well they performed. Get this wrong and users review too often (wasted time) or too rarely (they forget).

---

## What Is FSRS?

FSRS (Free Spaced Repetition Scheduler) is an algorithm that optimizes review timing. The core idea: when you successfully recall something, the interval before your next review should increase. When you fail, the interval resets to a short duration. FSRS is mathematically modeled after how human memory actually decays, making it more effective than older algorithms like SM-2 (used in Anki).

Each "card" (a user-problem pair) has:
- **Stability** — how long (in days) until you have a 90% chance of forgetting. Higher stability = longer intervals.
- **Difficulty** — how hard this particular card is for you (0-1 scale). Harder cards get shorter intervals.
- **Due** — when you should review next.
- **State** — New (never seen), Learning (recently introduced), Review (in regular rotation), Relearning (failed after previously knowing).

---

## The `scheduleNext()` Function

This is the most important function in the file. It takes a user's performance and returns an updated card with a new due date.

```ts
export function scheduleNext(
  card: Card,
  passed: boolean,
  timeSpent: number,
  timeLimit: number,
  timedMode: boolean
): { card: Card; rating: Rating }
```

### How Ratings Are Assigned

FSRS has 4 ratings: Again (1), Hard (2), Good (3), Easy (4). We map user performance to these:

| Scenario | Rating | What It Means |
|---|---|---|
| Failed the problem | Again (1) | Card goes back to short intervals (relearning) |
| Passed in timed mode but used >80% of time | Hard (2) | They got it but struggled under pressure |
| Passed and used <40% of time limit | Easy (4) | They crushed it — push the interval way out |
| Passed with moderate time | Good (3) | Normal successful review |

The time thresholds (0.4 and 0.8) are tunable. They're set conservatively: if you solve a 5-minute problem in under 2 minutes, you clearly know it well. If you barely made the timer, you need more practice.

### How FSRS Processes the Rating

```ts
const scheduling = f.repeat(card, new Date());
return scheduling[rating].card;
```

`f.repeat()` returns a scheduling object with 4 possible futures — one for each rating. We pick the one matching our rating. The returned card has updated `stability`, `difficulty`, `due`, `reps`, and `state`. We don't need to understand the internal math — we just save the result.

---

## The Adapter Functions: `cardFromDb()` and `cardToDb()`

FSRS uses Date objects and an enum for state. Our database stores ISO strings and integers. These two functions convert between the two representations:

```ts
// DB row → FSRS Card object
export function cardFromDb(row): Card {
  return {
    stability: row.stability,
    difficulty: row.difficulty,
    due: new Date(row.due),           // string → Date
    state: row.state as State,         // number → enum
    last_review: row.lastReview ? new Date(row.lastReview) : undefined,
    // ...
  };
}

// FSRS Card object → DB columns
export function cardToDb(card: Card) {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.toISOString(),       // Date → string
    state: card.state as number,        // enum → number
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}
```

This is the **Adapter pattern** — translating between two interfaces that don't naturally match. The rest of the app works with database rows, and this file is the only place that touches FSRS internals.

---

## The `fsrs()` Singleton

```ts
const f = fsrs();
```

This creates an FSRS instance with default parameters (optimized through research on millions of flashcard reviews). You can tune the parameters later by passing options to `fsrs()`, but the defaults work well. It's created once at module load time (singleton pattern) because the parameters don't change between calls.

---

## Why Not Just Use Raw Intervals?

You might think: "why not just say 'review in 1 day if they failed, 7 days if they passed'?" FSRS is better because:

1. **It adapts per card.** Easy problems get longer intervals faster. Hard problems stay in short rotation.
2. **It handles "lapsed" cards.** If you knew something but forgot, FSRS treats it differently than a card you never learned.
3. **The math is proven.** The decay curves are based on empirical studies of memory retention. Simple rules underperform.
