import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";
import { DDL, DEFAULT_USER_ID } from "./ddl";

const DB_FILE = process.env.RAMP_DB_PATH ?? path.join(process.cwd(), "ramp.db");

/**
 * Next dev-mode hot reloads re-evaluate modules, and each evaluation would
 * otherwise open another handle to the same SQLite file. Cache on globalThis so
 * we keep exactly one connection per process.
 */
const globalForDb = globalThis as unknown as {
  __rampSqlite?: Database.Database;
};

function connect(): Database.Database {
  const sqlite = new Database(DB_FILE);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Idempotent, so a fresh clone boots without a separate migration step.
  sqlite.exec(DDL);
  ensureDefaultUser(sqlite);
  return sqlite;
}

function ensureDefaultUser(sqlite: Database.Database) {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO users (id, name, email, daily_goal, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(DEFAULT_USER_ID, "You", "you@ramp.local", 20, "{}", new Date().toISOString());
}

export const sqlite = globalForDb.__rampSqlite ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__rampSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema, DEFAULT_USER_ID };
