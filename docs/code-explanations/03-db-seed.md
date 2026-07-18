# `src/lib/db/seed.ts` — Database Seeding Script

**What this file does:** Creates all database tables and populates them with initial data from the `seed-data/` JSON files. Run it with `npm run db:seed`.

**Why it matters:** This is how the app gets its initial content (categories, patterns, 20 problems) and its default user. Understanding the seed script helps you understand how to add new content.

---

## The Two-Phase Approach

### Phase 1: Create Tables (raw SQL)
```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS categories (...)`);
```

We use raw SQL (`sqlite.exec`) instead of Drizzle migrations for table creation. Why?
- **Simpler for V1** — no migration files to manage
- **`IF NOT EXISTS`** makes it idempotent — safe to run repeatedly
- The seed script is both the migration system and the data loader

In a production app, you'd use Drizzle Kit's migration system (`drizzle-kit generate` + `drizzle-kit migrate`). But for a local dev tool, this keep-it-simple approach works.

### Phase 2: Insert Data (Drizzle ORM)
```ts
db.insert(schema.categories).values(cat).onConflictDoNothing().run();
```

`onConflictDoNothing()` is the key. It means: if a row with this primary key already exists, skip it silently. This makes the entire seed script **idempotent** — you can run it 100 times and get the same result as running it once.

---

## How Problem Seeding Works

Each problem JSON file has a `patterns` array of pattern IDs:
```json
{
  "id": "prob-str-t1-reverse",
  "title": "Reverse a String",
  "patterns": ["pat-two-pointer", "pat-string-traversal"],
  ...
}
```

The seed script destructures this:
```ts
const { patterns: patternIds, ...problem } = data;
```

The `...problem` rest gets inserted into the `problems` table. The `patternIds` get inserted into the `problem_patterns` join table separately. This is a common pattern when your source data has a different shape than your database schema.

**Important:** `testCases` and `hints` are arrays in JSON but TEXT columns in SQLite, so we `JSON.stringify()` them before inserting.

---

## The Default User

```ts
db.insert(schema.users).values({
  id: "default-user",
  name: "Developer",
  email: "dev@reps.local",
  ...
});
```

Phase 1 has no auth, so everything belongs to this hardcoded user. The seed also creates `userTierProgress` entries for each category, starting at Tier 1. Without these, the session builder wouldn't know what tier the user is at and couldn't select appropriate problems.

---

## How to Use This

```bash
npm run db:seed     # Create/seed the database
npm run db:reset    # Delete the DB file and re-seed from scratch
```

To add a new problem: create a JSON file in `seed-data/problems/`, then run `npm run db:seed`. It won't touch existing data (thanks to `onConflictDoNothing`), just adds the new problem.
