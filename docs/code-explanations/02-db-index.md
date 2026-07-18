# `src/lib/db/index.ts` — Database Connection

**What this file does:** Creates a single, shared database connection that every API route uses. It's only 14 lines, but every line matters.

---

## Line by Line

```ts
const dbPath = path.join(process.cwd(), "reps.db");
```
`process.cwd()` returns the project root directory (where `package.json` lives). The database file lives right there. This is a SQLite-specific pattern — the database is literally a file on disk.

```ts
const sqlite = new Database(dbPath);
```
`better-sqlite3` is a synchronous SQLite driver for Node.js. Unlike most database libraries that return Promises, this one returns results immediately. This is actually a *feature* — SQLite is an embedded database (no network calls), so synchronous access is faster and simpler.

```ts
sqlite.pragma("journal_mode = WAL");
```
**WAL = Write-Ahead Logging.** This is important. SQLite's default journal mode locks the entire database during writes, blocking all readers. WAL mode allows concurrent reads while a write is happening. Since Next.js may process multiple API requests at once, WAL prevents them from blocking each other.

```ts
sqlite.pragma("foreign_keys = ON");
```
SQLite has foreign key support but it's **OFF by default** (for backwards compatibility). Without this line, you could insert an attempt referencing a non-existent problem ID and the database wouldn't complain. With it on, the database enforces referential integrity — exactly what we want.

```ts
export const db = drizzle(sqlite, { schema });
```
This wraps the raw SQLite connection with Drizzle ORM, passing in our schema definitions so Drizzle knows the table structure. The resulting `db` object is what every API route imports to run queries.

---

## Why a Module-Level Singleton?

The connection is created at module load time (not inside a function). In Node.js, modules are cached after first import — so `import { db } from "@/lib/db"` in 10 different API routes all get the **same** `db` instance. This is intentional. Opening a new SQLite connection per request would be wasteful. One connection handles everything.

**Note for later:** If you ever switch to PostgreSQL or another network database, this file is the only place that changes. Everything else imports `db` and doesn't care what's behind it.
