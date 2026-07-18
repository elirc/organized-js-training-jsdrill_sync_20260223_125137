# `src/lib/sessionBuilder.ts` — Session Queue Builder

**What this file does:** Builds a personalized drill session for a user by selecting a mix of overdue review problems and new unseen problems, filtered by the user's unlocked tiers.

**Why it matters:** This is the "playlist builder" of the app. It determines *which* problems a user sees in what order. Get it wrong and users either grind easy problems forever or get slammed with problems they're not ready for.

---

## The Session Composition Strategy

The session is built in two phases with a target ratio:

```
60% overdue reviews + 40% new problems → shuffle → return
```

Why 60/40? Reviews are higher priority — if you have overdue cards, you're actively at risk of forgetting material. But a session of *only* reviews gets boring and doesn't introduce new concepts. 40% new material keeps things fresh.

```ts
const reviewLimit = Math.ceil(sessionSize * 0.6);
```

`Math.ceil` rounds up, so a 10-problem session allows up to 6 reviews. If you only have 3 overdue cards, you get 3 reviews + 7 new problems. The 60% is a *ceiling*, not a requirement.

---

## Phase 1: Overdue Reviews

```ts
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
```

Key details:
- **`lte(due, now)`** — "less than or equal to now" means the card's due date has passed. It's overdue.
- **`orderBy(asc(due))`** — Most overdue first. A card due 3 days ago gets priority over one due 1 hour ago. This is important because if the session size is small, you want to catch the cards most at risk of being forgotten.
- We then look up the full problem data for each overdue card's `problemId`.

---

## Phase 2: New Problems

```ts
const remaining = sessionSize - queue.length;
```

If we have room after reviews, we fill with problems the user hasn't seen:

```ts
let allProblems = db.select().from(schema.problems)
  .where(
    and(
      eq(schema.problems.isPublished, true),
      isNull(schema.problems.authorId)  // system problems only
    )
  ).all();
```

Two important filters are applied:

### Filter 1: Tier Gating
```ts
const maxTier = tierMap.get(p.categoryId) || 1;
return p.tier <= maxTier && ...;
```

A user starts at Tier 1 in every category. They can only see Tier 2 problems after promoting from Tier 1 (4 consecutive passes). The `tierMap` is built from the `userTierProgress` table — it maps each category ID to the user's current tier in that category.

The `|| 1` fallback handles the case where a category has no tier progress row (shouldn't happen after seeding, but defensive coding).

### Filter 2: Unseen Problems Only
```ts
!existingCardProblemIds.includes(p.id)
```

If a `userCards` row exists for this problem, the user has seen it before. We exclude it from the "new problems" pool because it'll show up as a review when its due date arrives.

### Sort Order
```ts
allProblems.sort((a, b) => {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return Math.random() - 0.5;
});
```

Lower tiers come first (foundations before advanced). Within the same tier, problems are randomized. The `Math.random() - 0.5` trick gives each comparison a random sign (+/-), which produces a roughly random order. It's not a perfect shuffle (it has slight bias), but it's sufficient for "pick a few random tier-1 problems."

---

## The `enrichProblem()` Helper

The database stores problems in normalized form — `categoryId` is a foreign key, patterns are in a separate join table. But the client needs a denormalized view with `categoryName` and a `patterns` array.

```ts
async function enrichProblem(
  p: typeof schema.problems.$inferSelect,
  isReview: boolean
): Promise<SessionProblem | null>
```

It does three things:
1. **Looks up the category** to get the display name
2. **Looks up pattern links** in the `problemPatterns` join table, then fetches the pattern details
3. **Parses JSON columns** — `testCases` and `hints` are stored as JSON strings in SQLite TEXT columns, so they get `JSON.parse()`d here

The `typeof schema.problems.$inferSelect` type is Drizzle's way of saying "the shape of a row from the problems table." It's inferred from the schema definition, so if you add a column to the schema, this type updates automatically.

---

## The Fisher-Yates Shuffle

```ts
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];  // Don't mutate the input
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

This is the **Fisher-Yates shuffle** (also called Knuth shuffle). It's the standard algorithm for producing an unbiased random permutation. It iterates backwards through the array, swapping each element with a random earlier element.

Why shuffle at all? Without it, the session would be: all reviews first, then all new problems, grouped by category. That's a bad user experience — you'd get five string problems in a row, then five array problems. Shuffling mixes them up for variety.

---

## Why `async`?

You might notice `buildSession` and `enrichProblem` are `async` even though all database calls are synchronous (better-sqlite3). This is forward-looking — if you switch to an async database driver (like PostgreSQL), the function signatures won't need to change. It also doesn't hurt performance because `async` functions that never `await` are essentially synchronous.
