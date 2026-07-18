# `src/app/api/dashboard/route.ts` — Dashboard Aggregation API

**What this file does:** Handles `GET /api/dashboard`. Aggregates data from multiple tables into a single response containing category progress, activity heatmap data, pattern strengths, and overall statistics.

**Why it matters:** This is the most data-intensive endpoint in the app. It touches 6 tables and performs multiple aggregations. Understanding it teaches you how to build "read-heavy" analytics endpoints and where performance bottlenecks might appear.

---

## The Response Shape

The dashboard API returns four sections:

```ts
{
  categoryProgress: [...],   // Per-category tier level + solve stats
  activity: [...],           // Date → attempt count for heatmap
  patternStrengths: [...],   // Per-pattern mastery levels
  stats: {                   // Global summary numbers
    totalAttempts, passedAttempts, passRate
  }
}
```

One API call, one response — the dashboard page makes a single `fetch()`. This is the **aggregation endpoint** pattern: rather than making 4 separate API calls from the client (one per section), we build one server-side endpoint that gathers everything. Fewer round-trips = faster page loads.

---

## Category Progress

```ts
const categoryProgress = categories.map((cat) => {
  const tp = tierProgress.find((t) => t.categoryId === cat.id);

  const totalProblems = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.problems)
    .where(eq(schema.problems.categoryId, cat.id))
    .get();

  const solvedCards = db
    .select()
    .from(schema.userCards)
    .innerJoin(
      schema.problems,
      eq(schema.userCards.problemId, schema.problems.id)
    )
    .where(
      and(
        eq(schema.userCards.userId, DEFAULT_USER_ID),
        eq(schema.problems.categoryId, cat.id)
      )
    )
    .all();
```

This is the most complex query in the app. Let's break down the `innerJoin`:

**The problem:** `userCards` stores `problemId` but not `categoryId`. To find "cards in the Strings category," we need to join through `problems`.

**The join:** `userCards.problemId = problems.id` links each card to its problem. Then we filter where the problem's `categoryId` matches and the card belongs to our user.

**`innerJoin` vs `leftJoin`:** Inner join only returns rows where both sides match. If a card references a deleted problem, it's excluded. This is correct behavior — we don't want phantom cards in the stats.

**Average stability calculation:**
```ts
const avgStability =
  solvedCards.length > 0
    ? solvedCards.reduce((sum, c) => sum + c.user_cards.stability, 0) /
      solvedCards.length
    : 0;
```

After a join, Drizzle namespaces the columns: `c.user_cards.stability` (from the `userCards` table) vs `c.problems.categoryId` (from the `problems` table). The stability average gives a rough measure of how well the user knows problems in this category.

---

## Activity Heatmap

```ts
const activityMap = new Map<string, number>();
for (const a of recentAttempts) {
  const date = a.createdAt.split("T")[0];
  activityMap.set(date, (activityMap.get(date) || 0) + 1);
}
```

This groups attempts by date. `createdAt` is an ISO string like `"2024-01-15T10:30:00.000Z"`, and `.split("T")[0]` extracts just the date part: `"2024-01-15"`.

The `Map` acts as a counter — for each date, we increment the count. Then we convert to an array and sort chronologically:

```ts
const activity = Array.from(activityMap.entries())
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date));
```

ISO dates sort correctly with string comparison because the format is year-month-day. `"2024-01-15" < "2024-01-16"` is true.

**Performance note:** We fetch *all* attempts, not just the last 90 days. For V1 with a single user, this is fine. At scale, you'd add a date filter to the query: `gte(schema.attempts.createdAt, ninetyDaysAgo.toISOString())`.

---

## Pattern Strengths

```ts
const patternStrengths = allPatterns.map((pat) => {
  const linkedProblems = db.select()
    .from(schema.problemPatterns)
    .where(eq(schema.problemPatterns.patternId, pat.id))
    .all();

  for (const pid of problemIds) {
    const card = db.select()
      .from(schema.userCards)
      .where(
        and(
          eq(schema.userCards.userId, DEFAULT_USER_ID),
          eq(schema.userCards.problemId, pid)
        )
      )
      .get();

    if (card && card.reps > 0) {
      solvedCount++;
      totalStability += card.stability;
    }
  }
```

For each pattern, we:
1. Find all problems linked to that pattern (via the join table)
2. For each linked problem, check if the user has a card with `reps > 0` (they've reviewed it at least once)
3. Sum up stability values

The **strength classification** maps average stability to a human-readable level:

```ts
let strength: "none" | "weak" | "learning" | "strong" = "none";
if (solvedCount === 0) strength = "none";
else if (avgStab < 3) strength = "weak";
else if (avgStab < 10) strength = "learning";
else strength = "strong";
```

These thresholds (3 and 10 days) are chosen based on FSRS behavior:
- **< 3 days stability**: You just learned this. One failure and it resets. "Weak."
- **3-10 days**: You've done a few successful reviews. Memory is forming. "Learning."
- **> 10 days**: FSRS has extended your interval past 10 days, meaning you've consistently remembered. "Strong."

---

## The N+1 Query Problem

You might notice this endpoint makes many database queries inside loops — one per category, one per pattern, one per problem-per-pattern. This is the **N+1 query problem**: 1 query to get all patterns, then N queries (one per pattern) to get their linked problems.

For V1 with ~12 patterns and ~20 problems, this runs in milliseconds because SQLite is an embedded database (no network round-trips). For a production app with 1000+ patterns, you'd want to:
1. Use SQL JOINs to fetch everything in fewer queries
2. Use `GROUP BY` with aggregates instead of iterating in code
3. Or precompute these stats and cache them

But premature optimization is the root of all evil. The current approach is readable, correct, and fast enough for its scale.
