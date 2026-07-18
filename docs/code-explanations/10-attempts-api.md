# `src/app/api/attempts/route.ts` — Attempt Recording API

**What this file does:** Handles `POST /api/attempts`. When a user submits their solution, this endpoint records the attempt, updates the FSRS spaced repetition card, and manages tier progression.

**Why it matters:** This is where learning data gets persisted. Every time you click "Submit" on the drill page, this endpoint fires. It's the bridge between "user solved a problem" and "the system knows when to show it again."

---

## The 4-Step Pipeline

Every attempt flows through 4 sequential steps:

```
1. Record the attempt → 2. Get/create FSRS card → 3. Schedule next review → 4. Update tier progress
```

### Step 1: Record the Attempt

```ts
const attempt = {
  id: generateId(),
  userId: DEFAULT_USER_ID,
  problemId,
  code,
  approachText: approachText || "",
  passed: !!passed,
  timeSpent: timeSpent || 0,
  timedMode: !!timedMode,
  errorType: errorType || null,
  createdAt: timestamp,
};

db.insert(schema.attempts).values(attempt).run();
```

The attempt is an immutable audit log — it records exactly what happened. The `!!passed` double-bang coerces to boolean (`undefined` → `false`, `1` → `true`). The `|| ""` and `|| 0` provide defaults for optional fields.

This raw data is valuable even if FSRS changes in the future — you can always recompute cards from the attempt history.

### Step 2: Get or Create the FSRS Card

```ts
let existingCard = db.select()
  .from(schema.userCards)
  .where(
    and(
      eq(schema.userCards.userId, DEFAULT_USER_ID),
      eq(schema.userCards.problemId, problemId)
    )
  )
  .get();

if (!existingCard) {
  const newCard = createNewCard();
  const cardData = cardToDb(newCard);
  existingCard = {
    id: generateId(),
    userId: DEFAULT_USER_ID,
    problemId,
    ...cardData,
  };
  db.insert(schema.userCards).values(existingCard).run();
}
```

The **user×problem** pair is the unique key for a card. `.get()` returns a single row or `undefined`. If no card exists (first time the user attempts this problem), we create a fresh FSRS card with default values (state=New, stability=0, difficulty=0).

This is the **lazy initialization** pattern — we don't create cards for all 20 problems upfront, only when the user first encounters each one. This keeps the database lean and makes it trivial to add new problems.

### Step 3: Schedule the Next Review

```ts
const card = cardFromDb(existingCard);
const { card: updatedCard, rating } = scheduleNext(
  card, !!passed, timeSpent || 0, timeLimit, !!timedMode
);
const updatedCardData = cardToDb(updatedCard);

db.update(schema.userCards)
  .set(updatedCardData)
  .where(eq(schema.userCards.id, existingCard.id))
  .run();
```

Three conversions happen:
1. `cardFromDb()` — DB row → FSRS Card (strings to Dates, numbers to enums)
2. `scheduleNext()` — FSRS processes the rating and returns an updated card with a new due date
3. `cardToDb()` — FSRS Card → DB row (Dates to strings, enums to numbers)

The `rating` is returned in the API response so the client could display "You rated: Good" or similar feedback.

### Step 4: Update Tier Progress

```ts
if (passed && problem) {
  updateTierProgress(problem.categoryId);
}
```

Only triggers on successful solves. The `updateTierProgress` function is extracted to keep the main handler readable.

---

## The Tier Promotion Logic

```ts
function updateTierProgress(categoryId: string) {
  const progress = db.select()
    .from(schema.userTierProgress)
    .where(
      and(
        eq(schema.userTierProgress.userId, DEFAULT_USER_ID),
        eq(schema.userTierProgress.categoryId, categoryId)
      )
    )
    .get();

  const newConsecutive = progress.consecutivePass + 1;

  if (newConsecutive >= 4 && progress.currentTier < 5) {
    db.update(schema.userTierProgress)
      .set({
        currentTier: progress.currentTier + 1,
        consecutivePass: 0,
        tierUnlockedAt: now(),
      })
      .run();
  } else {
    db.update(schema.userTierProgress)
      .set({ consecutivePass: newConsecutive })
      .run();
  }
}
```

The rule: **4 consecutive passes in a category promotes you to the next tier.** The counter resets to 0 on promotion. `currentTier < 5` caps it at Tier 5 (the maximum).

**What's missing:** The counter doesn't reset on failure. If you pass 3, fail 1, pass 1 — the counter shows 4 and you promote. This is intentional for V1 simplicity but might be tightened later to truly require 4 *consecutive* passes by resetting on failure.

---

## Input Validation

```ts
if (!problemId || code === undefined) {
  return NextResponse.json(
    { success: false, error: "Missing required fields" },
    { status: 400 }
  );
}
```

Minimal validation — we check the two truly required fields. `code === undefined` (not `!code`) because empty string is valid code (the user cleared the editor). Other fields get sensible defaults via `|| ""` and `|| 0`.

---

## The Response

```ts
return NextResponse.json({
  success: true,
  data: {
    attemptId: attempt.id,
    rating,
    nextDue: updatedCardData.due,
  },
});
```

The client currently ignores the response body (fire-and-forget), but returning structured data makes it possible to show "Next review: in 3 days" or similar feedback without a second API call.
