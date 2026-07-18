# `src/lib/db/schema.ts` — The Database Schema

**What this file does:** Defines every table in the database using Drizzle ORM's TypeScript API. This is the single source of truth for the shape of all data in the app.

**Why it matters:** If you understand this file, you understand the app's data model. Every API route, every query, every component ultimately reads from or writes to the structures defined here.

---

## How Drizzle Schema Definitions Work

Each `sqliteTable()` call maps to a SQL `CREATE TABLE` statement. The first argument is the table name in SQL (snake_case by convention), and the second is an object defining columns.

```ts
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ...
});
```

This produces a SQL table like:
```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
```

The key insight: Drizzle uses these definitions at *runtime* to build queries **and** at *compile time* for TypeScript type inference. When you write `db.select().from(schema.categories)`, TypeScript knows the result has `id: string`, `name: string`, etc.

---

## The Tables, Explained

### `categories` — Problem Groupings
Simple lookup table. Five rows: Strings, Arrays, Objects/Maps, Recursion, Sorting/Searching. The `sortOrder` column controls display order so we don't rely on alphabetical sorting.

### `patterns` — Reusable Problem-Solving Strategies
Patterns are the teaching core of the app. "Two Pointer," "Hash Map Lookup," "Accumulator," etc. The `slug` field is a URL-safe identifier (`two-pointer`) — it's unique because we use it in URLs and references. The `explanation` field is a longer teaching text shown when a user clicks to learn more.

### `problems` — The Coding Challenges
This is the biggest table. Key design decisions:

- **`testCases` is a JSON string**, not a separate table. We always read/write all test cases at once, never query them individually.
- **`authorId` is nullable**. `null` means it's a system/dev problem (visible to all). A non-null value means a user created it (private to them). This single column is how we distinguish system vs. user content.
- **`tier` is 1-5**, mapping to Foundation → Interview-Ready. The session builder uses this + the user's tier progress to decide which problems are available.
- **`isPublished`** lets you draft problems without them appearing in sessions.
- **`starterCode`** is what the user sees when the editor loads. **`solutionCode`** is a reference solution for the dev (not shown to users in V1).

### `problemPatterns` — The Many-to-Many Join Table
A problem can have multiple patterns (e.g., "Two Sum" uses both `hash-lookup` and `accumulator`). A pattern applies to many problems. This join table connects them. The composite primary key `(problemId, patternId)` prevents duplicates.

**Why `onDelete: "cascade"`?** If you delete a problem, its pattern links get automatically cleaned up. No orphan rows.

### `users` — User Accounts
Phase 1 has a single hardcoded user (`default-user`). But the schema is multi-user ready. The `settings` JSON column is a grab bag for preferences we haven't formalized yet — it's the "extensibility valve."

### `attempts` — Every Submission, Ever
This is an append-only log. Every time a user hits "Submit," a row gets inserted. We never update or delete attempts. This gives us a complete history for analytics.

Key columns:
- `approachText` — what they said they'd do before coding
- `errorType` — classified by the error classifier (edge-case-miss, off-by-one, etc.)
- `timedMode` — whether the timer was running (affects FSRS rating)

### `userCards` — FSRS Spaced Repetition State
One row per user-problem pair. This is the FSRS algorithm's memory. The columns map directly to FSRS's internal `Card` type:

- `stability` — how "strong" the memory is (higher = longer intervals)
- `difficulty` — how hard the problem is for this user (0-1 scale)
- `due` — the ISO timestamp when the problem should be reviewed next
- `reps` — how many times they've reviewed it
- `lapses` — how many times they failed after previously knowing it
- `state` — 0=New, 1=Learning, 2=Review, 3=Relearning

**Critical rule:** Never manually edit these values. Always use `fsrs.ts`'s `scheduleNext()` function.

### `userTierProgress` — Difficulty Progression
One row per user-category pair. Tracks which tier the user has unlocked in each category. `consecutivePass` counts how many problems they've passed in a row — at 4, they get promoted to the next tier.

### `userProblemVersions` — User Forks of System Problems
When a user wants to modify a system problem (change the description, add notes, tweak test cases), they create a "version" rather than editing the original. This preserves the dev's canonical version while giving users personal customization.

### `sharedItems` + `problemSets` + `problemSetItems`
These support user content sharing. A user can create a curated set of problems, then generate a share code (short unique string) that others can use to import the set. Not fully wired up in the UI yet — the schema is ready for future development.

---

## The `primaryKey()` Pattern for Join Tables

```ts
(table) => [primaryKey({ columns: [table.problemId, table.patternId] })]
```

This is Drizzle's way of defining a composite primary key. It means the combination of `(problemId, patternId)` must be unique. You can't link the same problem to the same pattern twice, but a problem can link to many patterns and a pattern can link to many problems. This is the standard way to implement many-to-many relationships in SQL.

---

## Why Text IDs Instead of Auto-Increment Integers?

We use UUIDs (stored as TEXT) instead of `INTEGER PRIMARY KEY AUTOINCREMENT`. Reasons:
1. **Seed data has deterministic IDs** — `cat-strings`, `prob-arr-t1-find-max`, etc. These are readable and predictable, making debugging easy.
2. **No conflicts across environments** — if two people seed their local databases, they get the same IDs. With auto-increment, order-dependent issues arise.
3. **User-created content uses UUIDs** — `generateId()` produces them. No ID collisions when merging data between users.
