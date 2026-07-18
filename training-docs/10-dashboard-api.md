# Training Doc: Dashboard API (`src/app/api/dashboard/route.ts`)

## Purpose
This API route is the **analytics engine** of the application. It aggregates data from multiple tables to produce dashboard metrics: category progress, activity heatmap data, pattern strength assessments, and overall statistics. It's the most query-heavy route in the system, demonstrating complex data aggregation patterns.

## Prerequisites
- Understanding of the database schema — especially `userCards`, `userTierProgress`, `attempts`, `problems`, `patterns`, `problemPatterns` (see `01-schema.md`)
- Understanding of FSRS stability values and what they mean (see `06-fsrs.md`)
- SQL concepts: JOINs, COUNT, aggregation

---

## Line-by-Line Walkthrough of Key Code

### Lines 9–60 — Category Progress Computation
```typescript
const tierProgress = db
  .select()
  .from(schema.userTierProgress)
  .where(eq(schema.userTierProgress.userId, DEFAULT_USER_ID))
  .all();

const categories = db
  .select()
  .from(schema.categories)
  .orderBy(asc(schema.categories.sortOrder))
  .all();
```
**Why this matters:** First, we load all tier progress rows and all categories separately, then join them in JavaScript. This is sometimes called **application-side joining** — loading related data separately and combining it in code rather than using a SQL JOIN.

```typescript
const categoryProgress = categories.map((cat) => {
  const tp = tierProgress.find((t) => t.categoryId === cat.id);
```
**Why this matters:** For each category, we find the matching tier progress row using `Array.find()`. This is an O(n) search, but with only 4-5 categories, performance is irrelevant. The `tp` variable could be `undefined` if no tier progress exists yet.

```typescript
  const totalProblems = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.problems)
    .where(eq(schema.problems.categoryId, cat.id))
    .get();
```
**Why this matters:** This demonstrates **raw SQL within Drizzle**:
- **`` sql<number>`count(*)` ``** — A tagged template literal that injects raw SQL. The `<number>` generic tells TypeScript the result type.
- **`.select({ count: ... })`** — Instead of selecting all columns, we select a computed value and name it `count`.
- This counts how many problems exist in each category.

```typescript
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
**Why this matters:** This is the first **JOIN** in the file:
- **`.innerJoin(table, condition)`** — Combines `userCards` with `problems` where the problem IDs match. INNER JOIN means only rows that match in both tables are included.
- **The WHERE clause** filters to: this user's cards AND problems in this category.
- The result contains both `user_cards` and `problems` data for each row.

```typescript
  const avgStability =
    solvedCards.length > 0
      ? solvedCards.reduce((sum, c) => sum + c.user_cards.stability, 0) /
        solvedCards.length
      : 0;
```
**Why this matters:** Computes the **average FSRS stability** across all problems the user has attempted in this category. This is a manual implementation of SQL's `AVG()` function in JavaScript. Higher average stability means the user has stronger retention in this category.

Note the `c.user_cards.stability` access pattern — when Drizzle does a JOIN, the result is namespaced by table: `c.user_cards.stability` (not just `c.stability`).

---

### Lines 62–79 — Activity Heatmap Data
```typescript
const recentAttempts = db
  .select()
  .from(schema.attempts)
  .where(eq(schema.attempts.userId, DEFAULT_USER_ID))
  .all();

const activityMap = new Map<string, number>();
for (const a of recentAttempts) {
  const date = a.createdAt.split("T")[0];
  activityMap.set(date, (activityMap.get(date) || 0) + 1);
}
const activity = Array.from(activityMap.entries())
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date));
```
**Why this matters:** This builds the data for a GitHub-style activity heatmap. The algorithm:

1. **Fetch all attempts** for this user (no date filter here — the component handles display range).
2. **Group by date** using a `Map`. The key is the date portion of the ISO timestamp (e.g., `"2024-03-15T10:30:00Z".split("T")[0]` → `"2024-03-15"`).
3. **Count per day** — `(activityMap.get(date) || 0) + 1` is the standard "increment or initialize" pattern with Maps.
4. **Convert to array and sort** — `Map.entries()` returns `[key, value]` pairs. We destructure them into `{ date, count }` objects and sort chronologically.

---

### Lines 82–131 — Pattern Strengths
```typescript
const allPatterns = db.select().from(schema.patterns).all();
const patternStrengths = allPatterns.map((pat) => {
  const linkedProblems = db
    .select()
    .from(schema.problemPatterns)
    .where(eq(schema.problemPatterns.patternId, pat.id))
    .all();

  const problemIds = linkedProblems.map((lp) => lp.problemId);

  let solvedCount = 0;
  let totalStability = 0;

  for (const pid of problemIds) {
    const card = db
      .select()
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
**Why this matters:** For each coding pattern, we calculate how strong the user is by:
1. Finding all problems linked to this pattern (via junction table)
2. For each linked problem, checking if the user has a card AND has at least 1 review (`card.reps > 0`)
3. Accumulating the stability values for averaging

This is an N+1 query pattern (query per problem per pattern), acceptable for the small dataset.

```typescript
  let strength: "none" | "weak" | "learning" | "strong" = "none";
  if (solvedCount === 0) strength = "none";
  else if (avgStab < 3) strength = "weak";
  else if (avgStab < 10) strength = "learning";
  else strength = "strong";
```
**Why this matters:** The **strength classification thresholds** turn continuous stability numbers into meaningful categories:
- **< 3 stability** → "weak" (the user forgets this pattern within a few days)
- **3–10 stability** → "learning" (building familiarity, reviews working)
- **> 10 stability** → "strong" (deeply remembered, long review intervals)

These thresholds are somewhat arbitrary but based on FSRS stability semantics.

---

### Lines 133–151 — Overall Stats and Response
```typescript
const totalAttempts = recentAttempts.length;
const passedAttempts = recentAttempts.filter((a) => a.passed).length;

return NextResponse.json({
  success: true,
  data: {
    categoryProgress,
    activity,
    patternStrengths,
    stats: {
      totalAttempts,
      passedAttempts,
      passRate:
        totalAttempts > 0
          ? Math.round((passedAttempts / totalAttempts) * 100)
          : 0,
    },
  },
});
```
**Why this matters:** The final response assembles ALL dashboard data into a single JSON payload:
- **`passRate` calculation** — Divides passed by total, multiplies by 100 for percentage, rounds to integer. The `totalAttempts > 0` guard prevents division by zero (which would produce `NaN`).
- **Single response** — All dashboard data comes from one API call rather than multiple endpoints. This reduces HTTP round-trips and makes the frontend simpler.

---

## How This File Connects to the Rest of the App
- **Called by** the dashboard page (`app/app/dashboard/page.tsx`) on load
- **Reads from** `userTierProgress`, `categories`, `problems`, `userCards`, `attempts`, `patterns`, `problemPatterns`
- **Returns** `{ categoryProgress, activity, patternStrengths, stats }` consumed by `HeatMap`, `CategoryStrength`, `PatternMap` components
- **Depends on** the attempts API having recorded user activity and FSRS having updated card stability values

## Key Takeaways
1. This route aggregates data from 7 different tables into one response
2. Application-side joining (loading separately, combining in JS) is used instead of complex SQL JOINs
3. The `Map` data structure is ideal for grouping/counting operations
4. Stability thresholds (3, 10) convert continuous values to categorical labels
5. The N+1 query pattern is acceptable here but would need optimization at scale
