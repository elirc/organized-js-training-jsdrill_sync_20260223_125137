# Training Doc: FSRS Spaced Repetition (`src/lib/fsrs.ts`)

## Purpose
This file wraps the `ts-fsrs` library — an implementation of the **Free Spaced Repetition Scheduler** algorithm. FSRS is the scientific engine behind "when should this problem be shown again?" It's more modern and accurate than the classic SM-2 algorithm (used by Anki). This file translates between the app's domain concepts (passed/failed, time spent, timed mode) and the FSRS library's rating system.

## Prerequisites
- Basic understanding of spaced repetition: if you remember something, review it later; if you forget, review it sooner
- The concept of FSRS ratings: Again (1), Hard (2), Good (3), Easy (4)
- Understanding of how `userCards` stores FSRS state (see `01-schema.md`)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–3 — Imports and FSRS Instance
```typescript
import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";

const f = fsrs();
```
**Why this matters:**
- **`createEmptyCard`** — Factory function that creates a new FSRS card with default values (stability=0, difficulty=0, state=New).
- **`fsrs()`** — Creates an FSRS scheduler instance with default parameters. This instance calculates optimal review intervals based on the card's history. The `f` variable is created at module level (not inside a function), so it's a **singleton** — one instance shared across all requests. This is efficient because FSRS parameters don't change between requests.
- **`Rating`** — An enum: `Again=1`, `Hard=2`, `Good=3`, `Easy=4`. Higher ratings mean the card is easier and gets scheduled further out.
- **`State`** — An enum: `New=0`, `Learning=1`, `Review=2`, `Relearning=3`. Tracks the card's lifecycle.
- **`type Card`** — TypeScript type for an FSRS card object.

---

### Lines 7–9 — Creating New Cards
```typescript
export function createNewCard(): Card {
  return createEmptyCard();
}
```
**Why this matters:** This is a thin wrapper around the library's `createEmptyCard()`. The wrapper exists so the rest of the app imports from our `fsrs.ts` instead of directly from `ts-fsrs`. This is the **facade pattern** — if we ever switch FSRS libraries, we only change this file.

---

### Lines 11–34 — `scheduleNext` (THE CORE RATING LOGIC)
```typescript
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
```
**Why this matters:** This is the most important function in the file — it decides how the FSRS algorithm rates each attempt.

**The Rating Decision Tree:**
```
Failed? → Again (show again soon, in minutes/hours)
  ↓ (passed)
Timed mode AND took >80% of time limit? → Hard (show again in 1-2 days)
  ↓
Finished in <40% of time limit? → Easy (show again in weeks/months)
  ↓
Everything else → Good (show again in days/weeks)
```

- **`Rating.Again`** — The user failed. FSRS will schedule a quick re-review (minutes to hours). The card's `lapses` counter increments, and `state` may move to "Relearning."
- **`Rating.Hard`** — The user passed but struggled (barely within time limit). The review interval increases, but conservatively.
- **`Rating.Easy`** — The user nailed it quickly. FSRS will push the next review far into the future.
- **`Rating.Good`** — The standard "I got it" rating. Moderate interval increase.

**The key insight is the time-based rating logic.** The app doesn't just care if you got the answer right — it cares HOW you got it. Passing in 30 seconds (under 40% of a 5-minute limit) suggests mastery. Passing at 4 minutes (over 80%) suggests you barely remembered.

**`f.repeat(card, new Date())`** — This is the FSRS algorithm's core method. It takes the current card state and the current timestamp, then returns a map of ALL possible next states (one for each rating). Think of it as: "if I rate this card as Again, here's the new state; if Hard, here's the new state..." etc.

**`scheduling[rating].card`** — We pick the specific next-state that matches our calculated rating. The returned `card` object contains the updated `due` date, new `stability`, new `difficulty`, etc.

---

### Lines 36–56 — Database Conversion: `cardFromDb`
```typescript
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
```
**Why this matters:** The database stores dates as ISO strings and states as integers, but the FSRS library expects `Date` objects and `State` enums. This function handles the conversion:

- **`new Date(row.due)`** — Parses the ISO string `"2024-03-15T10:00:00Z"` into a JavaScript `Date` object.
- **`row.state as State`** — Type assertion: tells TypeScript to treat the integer as the `State` enum type. This is safe because we control what goes into the database.
- **`row.lastReview ? new Date(row.lastReview) : undefined`** — Conditional conversion. `lastReview` is null for new cards that haven't been reviewed yet.
- **`elapsed_days: 0, scheduled_days: 0`** — These are runtime-only fields that FSRS recalculates. We set them to 0 as placeholders.

---

### Lines 58–68 — Database Conversion: `cardToDb`
```typescript
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
```
**Why this matters:** The reverse conversion — from FSRS `Card` objects back to database-storable values. `Date` objects become ISO strings with `.toISOString()`, and the `State` enum becomes a plain integer.

---

### Lines 70–72 — Overdue Check
```typescript
export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) <= new Date();
}
```
**Why this matters:** A simple utility that checks if a card's due date has passed. Used elsewhere in the app to determine if a card needs review. ISO date strings can be compared as dates because `new Date()` parses them correctly.

---

## FSRS Concepts Cheat Sheet

| Concept | Meaning | Effect |
|---------|---------|--------|
| **Stability** | How well the user knows this problem | Higher = longer intervals between reviews |
| **Difficulty** | How hard this problem is for this user | Higher = shorter intervals, slower stability growth |
| **Due** | When the next review should happen | Session builder checks this |
| **Reps** | Total number of reviews | Increases with each attempt |
| **Lapses** | Times the user "forgot" (failed after previous pass) | High lapses = the card needs more frequent review |
| **State** | Where in the learning cycle (New/Learning/Review/Relearning) | Affects how ratings change the card |

---

## How This File Connects to the Rest of the App
- **Called by** `api/attempts/route.ts` after each user submission
- **`scheduleNext`** determines the next review date, which gets stored in `userCards.due`
- **`cardFromDb`/`cardToDb`** are used by the attempts API for type conversion
- **The `due` dates** drive the session builder's overdue card selection
- **Stability values** feed into dashboard analytics (pattern strength, category progress)

## Key Takeaways
1. FSRS is more sophisticated than SM-2 — it models memory stability and difficulty separately
2. The rating isn't just pass/fail — time performance matters (40% and 80% thresholds)
3. `cardFromDb`/`cardToDb` handle the impedance mismatch between the library and SQLite
4. The facade pattern isolates the FSRS library — only this file imports from `ts-fsrs`
5. `f.repeat()` pre-calculates ALL possible outcomes; we just pick the one matching our rating
