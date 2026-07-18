# Training Doc: Database Schema (`src/lib/db/schema.ts`)

## Purpose
This file defines the **entire data model** for the Reps application using Drizzle ORM. Every table, column, relationship, and constraint in the SQLite database is declared here. If you want to understand what data the app stores and how entities relate to each other, this is the single source of truth.

## Prerequisites
- Basic understanding of relational databases (tables, columns, primary keys, foreign keys)
- Familiarity with TypeScript syntax
- Concept of an ORM (Object-Relational Mapping) — a library that lets you define database tables using code instead of raw SQL

---

## Line-by-Line Walkthrough of Key Code

### Line 1 — Imports from Drizzle ORM
```typescript
import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
```
**Why this matters:** Drizzle provides builder functions specific to each database engine. Since we use SQLite, we import from `sqlite-core`. Each import serves a specific purpose:
- `sqliteTable` — creates a new table definition
- `text`, `integer`, `real` — column type builders (string, whole number, decimal number)
- `primaryKey` — creates composite primary keys (primary keys made of multiple columns)

These functions don't execute SQL immediately — they produce a JavaScript object that Drizzle uses later to generate SQL when the app queries the database.

---

### Lines 4–10 — The `categories` Table
```typescript
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});
```
**Why this matters:** Categories are the top-level organizer for problems (e.g., "Strings", "Arrays", "Recursion"). Notice several patterns that repeat throughout the file:

- **`text("id").primaryKey()`** — We use text-based UUIDs as primary keys instead of auto-incrementing integers. This makes IDs globally unique and avoids conflicts when merging data.
- **`.notNull().default("")`** — The column cannot be NULL in the database, but if no value is provided during insert, it defaults to an empty string. This is a defensive pattern that prevents null-related bugs.
- **`sortOrder`** — Note the camelCase in TypeScript (`sortOrder`) vs snake_case in the actual database column name (`sort_order`). Drizzle handles this mapping — you write JS-friendly names while the database stays SQL-conventional.

---

### Lines 22–37 — The `problems` Table (Core Entity)
```typescript
export const problems = sqliteTable("problems", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  starterCode: text("starter_code").notNull(),
  solutionCode: text("solution_code").notNull().default(""),
  testCases: text("test_cases").notNull().default("[]"), // JSON
  tier: integer("tier").notNull().default(1),
  categoryId: text("category_id").notNull().references(() => categories.id),
  authorId: text("author_id"), // null = system problem
  hints: text("hints").notNull().default("[]"), // JSON
  timeLimit: integer("time_limit").notNull().default(300), // seconds
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```
**Why this matters:** This is the central table — everything in the app revolves around problems. Key things to understand:

- **`testCases: text("test_cases")`** — SQLite doesn't have a native JSON column type, so we store JSON as a plain text string and parse it in JavaScript with `JSON.parse()`. The `default("[]")` ensures an empty array instead of null.
- **`categoryId: text("category_id").notNull().references(() => categories.id)`** — This is a **foreign key**. It creates a database-level relationship: every problem must belong to an existing category. The arrow function `() => categories.id` is used (instead of a direct reference) because JavaScript needs to handle circular references between tables.
- **`authorId: text("author_id")`** — Notice this column has NO `.notNull()`. When `authorId` is `null`, the problem is a "system problem" (built-in). When it has a value, it's user-created. This is a common pattern called a **nullable discriminator**.
- **`isPublished: integer("is_published", { mode: "boolean" })`** — SQLite has no boolean type, so Drizzle uses `{ mode: "boolean" }` to automatically convert between 0/1 in SQLite and true/false in TypeScript.
- **`tier: integer("tier").notNull().default(1)`** — Problems are organized into difficulty tiers (1–5). This directly affects the spaced repetition system — users must unlock higher tiers by performing well at lower ones.

---

### Lines 40–51 — Many-to-Many: `problemPatterns` Junction Table
```typescript
export const problemPatterns = sqliteTable(
  "problem_patterns",
  {
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    patternId: text("pattern_id")
      .notNull()
      .references(() => patterns.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.problemId, table.patternId] })]
);
```
**Why this matters:** A single problem can use multiple coding patterns (e.g., "Two Pointers" + "Array Manipulation"), and a single pattern applies to many problems. This **many-to-many** relationship requires a junction table.

- **`{ onDelete: "cascade" }`** — If a problem or pattern is deleted, all matching rows in this junction table are automatically removed. Without this, you'd get orphaned rows pointing to deleted records.
- **`(table) => [primaryKey({ columns: [table.problemId, table.patternId] })]`** — The third argument to `sqliteTable` defines table-level constraints. This creates a **composite primary key**: the combination of `problemId` + `patternId` must be unique, preventing duplicate links.

---

### Lines 65–80 — The `attempts` Table (User Activity Log)
```typescript
export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  problemId: text("problem_id").notNull().references(() => problems.id),
  code: text("code").notNull(),
  approachText: text("approach_text").notNull().default(""),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  timeSpent: integer("time_spent").notNull().default(0),
  timedMode: integer("timed_mode", { mode: "boolean" }).notNull().default(false),
  errorType: text("error_type"),
  createdAt: text("created_at").notNull(),
});
```
**Why this matters:** Every time a user submits code for a problem, a row is created here. This is the **write-heavy** table in the system. It stores the full code they submitted, whether they passed, how long they took, and what kind of error occurred (if any). This data drives the dashboard analytics and feeds into the FSRS spaced repetition algorithm.

---

### Lines 83–98 — The `userCards` Table (FSRS State)
```typescript
export const userCards = sqliteTable("user_cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  problemId: text("problem_id").notNull().references(() => problems.id),
  stability: real("stability").notNull().default(0),
  difficulty: real("difficulty").notNull().default(0),
  due: text("due").notNull(),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0),
  lastReview: text("last_review"),
});
```
**Why this matters:** This is the **bridge between the app and the FSRS spaced repetition algorithm**. One row exists for each user-problem pair. Key fields:

- **`stability`** and **`difficulty`** — These are `real` (floating-point) numbers that the FSRS algorithm calculates. Stability represents how well the user knows this problem (higher = more remembered). Difficulty represents how hard the problem has been for this user.
- **`due`** — An ISO date string indicating when this problem should be reviewed next. The session builder checks this to find "overdue" cards.
- **`state`** — An integer enum: 0=New, 1=Learning, 2=Review, 3=Relearning. This tracks where the user is in their learning journey for this specific problem.
- **`reps`** — How many times the user has reviewed this problem.
- **`lapses`** — How many times the user "forgot" (failed after previously passing).

---

### Lines 101–113 — The `userTierProgress` Table
```typescript
export const userTierProgress = sqliteTable("user_tier_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: text("category_id").notNull().references(() => categories.id),
  currentTier: integer("current_tier").notNull().default(1),
  tierUnlockedAt: text("tier_unlocked_at").notNull(),
  consecutivePass: integer("consecutive_pass").notNull().default(0),
  lastDecayCheck: text("last_decay_check").notNull(),
});
```
**Why this matters:** This table controls **progression gating**. Users start at Tier 1 for each category. After 4 consecutive passes at their current tier, they unlock the next one. This prevents users from jumping to hard problems before mastering fundamentals.

- **`consecutivePass`** — Resets to 0 on a failure. Reaches 4 to trigger a tier promotion.
- **`currentTier`** — Determines which problems the session builder will include for new (unseen) problems.

---

## How This File Connects to the Rest of the App
- **`db/index.ts`** imports `* as schema` from this file to create the Drizzle database instance
- **Every API route** imports `schema` and uses these table definitions to query/insert data
- **`sessionBuilder.ts`** queries `userCards`, `userTierProgress`, and `problems` to build practice sessions
- **`fsrs.ts`** reads/writes the `userCards` table through the attempts API
- **Type definitions** in `types/index.ts` mirror many of these table structures for frontend use

## Key Takeaways
1. The schema is the foundation — understand this and you understand the data model
2. JSON-in-text columns (`testCases`, `hints`, `settings`) are a pragmatic SQLite pattern
3. The `userCards` table is the heart of the spaced repetition system
4. Foreign keys + cascade deletes maintain referential integrity
5. Composite primary keys on junction tables prevent duplicate relationships
