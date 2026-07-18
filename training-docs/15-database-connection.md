# Training Doc: Database Connection (`src/lib/db/index.ts`)

## Purpose
This is the **database initialization file** — the single point where the application connects to SQLite and configures the Drizzle ORM instance. Despite being only 15 lines, every database operation in the entire app flows through the objects exported from this file. Understanding it is essential because it's the foundation all API routes and business logic build on.

## Prerequisites
- Basic understanding of SQLite (a file-based database, no separate server process)
- Concept of an ORM (Object-Relational Mapping)
- Node.js module system (singleton pattern via module caching)

---

## Line-by-Line Walkthrough (Every Line Explained)

### Line 1 — SQLite Driver Import
```typescript
import Database from "better-sqlite3";
```
**Why this matters:** `better-sqlite3` is a Node.js binding to SQLite. Unlike most database drivers in Node.js, it's **synchronous** — queries block the thread until complete. This might sound bad, but for SQLite it's actually faster because:
1. SQLite runs in-process (no network round-trip)
2. Synchronous calls avoid the overhead of the Node.js event loop
3. Queries on a local file complete in microseconds

This is why you'll see `.get()` and `.all()` throughout the codebase without `await` — they return results immediately.

### Line 2 — Drizzle ORM Import
```typescript
import { drizzle } from "drizzle-orm/better-sqlite3";
```
**Why this matters:** Drizzle has separate entry points for each database driver. `drizzle-orm/better-sqlite3` is the adapter that makes Drizzle work with the `better-sqlite3` driver. Other databases would use `drizzle-orm/postgres-js`, `drizzle-orm/mysql2`, etc.

### Line 3 — Schema Import
```typescript
import * as schema from "./schema";
```
**Why this matters:** `import * as schema` imports ALL exports from `schema.ts` as a single object. So `schema.problems`, `schema.categories`, `schema.userCards`, etc. are all accessible. This namespace import is used (instead of individual imports) because:
1. It keeps the import clean regardless of how many tables exist
2. Every API route can do `db.select().from(schema.problems)` — the `schema` prefix makes it clear we're referencing a database table

### Line 4 — Path Import
```typescript
import path from "path";
```
**Why this matters:** Node.js `path` module handles file paths in a cross-platform way. `path.join()` uses the correct path separator for the current OS (`/` on Unix, `\` on Windows).

### Line 6 — Database File Path
```typescript
const dbPath = path.join(process.cwd(), "reps.db");
```
**Why this matters:**
- **`process.cwd()`** — Returns the current working directory (where `npm run dev` was executed). For this project, that's the `reps/` directory.
- **`"reps.db"`** — The SQLite database file. SQLite stores the entire database in a single file. No server installation needed.
- The resulting path is something like `/Users/Owner/Desktop/jsdrillapp/reps/reps.db`.

### Line 7 — SQLite Connection
```typescript
const sqlite = new Database(dbPath);
```
**Why this matters:** This creates the SQLite connection by opening (or creating) the database file. If `reps.db` doesn't exist, SQLite creates it automatically. The `sqlite` object is the low-level driver that Drizzle wraps.

### Lines 9–11 — SQLite Pragmas (PERFORMANCE CONFIGURATION)
```typescript
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
```
**Why this matters:** Pragmas are SQLite configuration settings. These two are critical:

- **`journal_mode = WAL`** — Switches to **Write-Ahead Logging** mode. Default SQLite uses rollback journals which lock the entire database during writes. WAL mode allows:
  - Multiple concurrent readers
  - Readers don't block writers (and vice versa)
  - Better performance for web applications where reads happen much more frequently than writes
  - This is why you see `reps.db-wal` and `reps.db-shm` files alongside `reps.db`

- **`foreign_keys = ON`** — SQLite has foreign key support but it's **disabled by default** (for backwards compatibility). Without this pragma, you could insert an `attempt` referencing a non-existent `problemId` and SQLite wouldn't complain. With it ON, foreign key violations throw errors, maintaining data integrity.

### Line 13 — Drizzle Instance
```typescript
export const db = drizzle(sqlite, { schema });
```
**Why this matters:** This creates the Drizzle ORM instance:
- **First argument `sqlite`** — The low-level database connection
- **`{ schema }`** — Passes the table definitions so Drizzle can provide TypeScript-safe query building

The `db` object is what every API route and service imports to query the database. It provides methods like:
- `db.select().from(schema.problems)` — Read queries
- `db.insert(schema.problems).values({...})` — Create records
- `db.update(schema.problems).set({...}).where(...)` — Update records
- `db.delete(schema.problems).where(...)` — Delete records

### Line 14 — Re-export Schema
```typescript
export { schema };
```
**Why this matters:** This allows other files to import both `db` and `schema` from one location:
```typescript
import { db, schema } from "@/lib/db";
```
Instead of having to import from two separate files. This is a convenience re-export.

---

## The Singleton Pattern

A crucial detail: this module is only executed ONCE by Node.js, regardless of how many files import it. This is because Node.js caches modules after first execution. So:
- File A imports `{ db }` → Module executes, connection opens, `db` is created
- File B imports `{ db }` → Module is cached, returns the SAME `db` instance

This means there's exactly **one database connection** for the entire application. This is the **module-level singleton pattern** — you get singleton behavior without explicitly writing singleton code.

---

## How This File Connects to the Rest of the App
- **Imported by** every API route (`api/problems`, `api/attempts`, `api/session`, `api/dashboard`, etc.)
- **Imported by** `sessionBuilder.ts` for direct database queries
- **Uses** `schema.ts` for table definitions
- **Creates** the single `db` instance used application-wide

## Key Takeaways
1. SQLite is a file-based database — no server needed, just a `.db` file
2. `better-sqlite3` is synchronous (no `await` needed for queries) — unusual but faster for SQLite
3. WAL mode is essential for web app performance (concurrent reads)
4. `foreign_keys = ON` must be explicitly enabled in SQLite
5. Node.js module caching creates a natural singleton — one connection for the whole app
6. Re-exporting `schema` from the `db` module is a convenience pattern
