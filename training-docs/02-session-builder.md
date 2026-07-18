# Training Doc: Session Builder (`src/lib/sessionBuilder.ts`)

## Purpose
This file contains the **core algorithm** that decides which problems a user practices during a drill session. It's the brain behind the "what should I study next?" question, implementing a mix of spaced repetition reviews and new material introduction. Understanding this file is essential because it directly controls the user's learning experience.

## Prerequisites
- Understanding of the database schema (see `01-schema.md`)
- Basic concept of spaced repetition (reviewing material at increasing intervals)
- Familiarity with async/await in TypeScript

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–3 — Imports
```typescript
import { db, schema } from "@/lib/db";
import { eq, and, lte, isNull, asc, inArray } from "drizzle-orm";
import type { SessionProblem } from "@/types";
```
**Why this matters:** The Drizzle ORM query operators are imported here. Each one maps to a SQL operation:
- `eq` → `=` (equals)
- `and` → `AND` (combine conditions)
- `lte` → `<=` (less than or equal)
- `isNull` → `IS NULL`
- `asc` → `ORDER BY ... ASC`
- `inArray` → `IN (...)` (match any value in a list)

Understanding these operators is key to reading any database query in the app.

---

### Lines 5–12 — Function Signature and Setup
```typescript
const DEFAULT_USER_ID = "default-user";

export async function buildSession(
  sessionSize: number,
  userId: string = DEFAULT_USER_ID
): Promise<SessionProblem[]> {
  const queue: SessionProblem[] = [];
  const now = new Date().toISOString();
```
**Why this matters:**
- **`DEFAULT_USER_ID`** — Phase 1 of the app uses a single hardcoded user. This constant appears throughout the codebase. When authentication is added later, the userId parameter will come from the session.
- **`sessionSize`** — Typically 10 problems. The caller (session API route) passes this in.
- **`queue`** — This array is what gets returned. The entire function's job is to fill this array with the right mix of problems.
- **`now`** — We capture the current timestamp once to ensure consistent "overdue" comparisons throughout the function.

---

### Lines 14–42 — Step 1: Get Overdue Review Cards (THE MOST IMPORTANT SECTION)
```typescript
  // 1. Get overdue review cards (sorted by most overdue)
  const overdueCards = db
    .select()
    .from(schema.userCards)
    .where(
      and(
        eq(schema.userCards.userId, userId),
        lte(schema.userCards.due, now)
      )
    )
    .orderBy(asc(schema.userCards.due))
    .all();

  const reviewLimit = Math.ceil(sessionSize * 0.6);
  const reviewCardSlice = overdueCards.slice(0, reviewLimit);
```
**Why this matters:** This is the **heart of the spaced repetition system**. Here's what's happening step by step:

1. **Query `userCards`** where the `due` date is in the past (`lte(due, now)` means "due date ≤ right now"). These are problems the FSRS algorithm has scheduled for review.
2. **Sort by `due` ascending** — the MOST overdue cards come first. A card due 2 weeks ago is more urgent than one due yesterday.
3. **The 60/40 split** — `Math.ceil(sessionSize * 0.6)` means 60% of the session is reviews. For a session of 10, that's 6 review slots. This ratio is a core design decision: prioritize reviewing old material over introducing new material.
4. **`.slice(0, reviewLimit)`** — Take only the most overdue cards up to the limit.

Then lines 30–42 fetch the actual problem data for these cards:
```typescript
  if (reviewCardSlice.length > 0) {
    const reviewProblemIds = reviewCardSlice.map((c) => c.problemId);
    const reviewProblems = db
      .select()
      .from(schema.problems)
      .where(inArray(schema.problems.id, reviewProblemIds))
      .all();

    for (const p of reviewProblems) {
      const sp = await enrichProblem(p, true);
      if (sp) queue.push(sp);
    }
  }
```
- **`inArray`** is the equivalent of SQL `WHERE id IN ('id1', 'id2', ...)` — it fetches all matching problems in one query instead of querying one at a time.
- **`enrichProblem(p, true)`** — The `true` flag marks this as a review problem (not new). This enrichment adds category names and pattern data.

---

### Lines 44–95 — Step 2: Fill Remaining Slots with New Problems
```typescript
  const remaining = sessionSize - queue.length;
  if (remaining > 0) {
    const tierProgress = db
      .select()
      .from(schema.userTierProgress)
      .where(eq(schema.userTierProgress.userId, userId))
      .all();

    const tierMap = new Map<string, number>();
    for (const tp of tierProgress) {
      tierMap.set(tp.categoryId, tp.currentTier);
    }
```
**Why this matters:** Before selecting new problems, we need to know which tiers the user has unlocked in each category. The `tierMap` is a lookup: `categoryId → maxUnlockedTier`. If a user is at Tier 2 in "Arrays", they can see Tier 1 and Tier 2 array problems, but not Tier 3+.

```typescript
    const existingCardProblemIds = db
      .select({ problemId: schema.userCards.problemId })
      .from(schema.userCards)
      .where(eq(schema.userCards.userId, userId))
      .all()
      .map((c) => c.problemId);
```
**Why this matters:** This gets IDs of ALL problems the user has ever attempted. We use this to exclude them from the "new problems" pool — a problem is "new" only if the user has never seen it.

```typescript
    let allProblems = db
      .select()
      .from(schema.problems)
      .where(
        and(
          eq(schema.problems.isPublished, true),
          isNull(schema.problems.authorId)
        )
      )
      .all();
```
**Why this matters:** We only select **published system problems** (`authorId` is null). User-created problems are excluded from auto-scheduling.

```typescript
    allProblems = allProblems.filter((p) => {
      const maxTier = tierMap.get(p.categoryId) || 1;
      return p.tier <= maxTier && !existingCardProblemIds.includes(p.id);
    });
```
**Why this matters:** This is the **tier gating logic**. Two conditions must be true:
1. The problem's tier must be ≤ the user's unlocked tier for that category
2. The user must not have seen this problem before

The `|| 1` default means if there's no tier progress record yet, the user starts at Tier 1.

```typescript
    allProblems.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return Math.random() - 0.5;
    });
```
**Why this matters:** Lower-tier problems come first (master fundamentals before advancing), but within the same tier, the order is randomized. The `Math.random() - 0.5` trick produces a random sort because it returns positive or negative with equal probability.

---

### Lines 97–99 — Step 3: Shuffle the Final Queue
```typescript
  return shuffle(queue);
```
**Why this matters:** Without shuffling, all review problems would come first, then all new problems, and they'd be clustered by category. Shuffling provides variety and prevents boredom.

---

### Lines 101–151 — The `enrichProblem` Helper
```typescript
async function enrichProblem(
  p: typeof schema.problems.$inferSelect,
  isReview: boolean
): Promise<SessionProblem | null> {
```
**Why this matters:** Raw database rows don't have category names or pattern data — just foreign key IDs. This function "enriches" each problem by:
1. Looking up the category name from the `categories` table
2. Looking up associated patterns via the `problemPatterns` junction table
3. Parsing JSON strings (`testCases`, `hints`) into actual arrays
4. Assembling everything into a `SessionProblem` object that the frontend can use directly

The `typeof schema.problems.$inferSelect` syntax is a Drizzle feature that automatically creates a TypeScript type matching the table's column types. It means "whatever shape a row from the problems table has."

---

### Lines 153–160 — Fisher-Yates Shuffle
```typescript
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```
**Why this matters:** This is the **Fisher-Yates shuffle algorithm** — the correct way to randomly shuffle an array. Key details:
- `[...arr]` creates a copy so the original isn't mutated
- It iterates backwards, swapping each element with a random element from the remaining unshuffled portion
- `[a[i], a[j]] = [a[j], a[i]]` is JavaScript destructuring swap syntax
- Unlike `array.sort(() => Math.random() - 0.5)`, Fisher-Yates produces a truly uniform random permutation

---

## How This File Connects to the Rest of the App
- **Called by** `api/session/route.ts` — the session API endpoint
- **Reads from** `userCards` (FSRS state), `userTierProgress` (tier gates), `problems`, `categories`, `patterns`, `problemPatterns`
- **Returns** `SessionProblem[]` which is consumed by the drill page (`app/app/page.tsx`)
- **Depends on** the FSRS system having populated `userCards.due` dates via the attempts API

## Key Takeaways
1. The 60/40 review-to-new ratio is the core design decision
2. Overdue reviews are prioritized by how overdue they are
3. New problems are gated by the user's tier progress in each category
4. The final queue is shuffled to prevent category clustering
5. This is where spaced repetition meets curriculum progression
