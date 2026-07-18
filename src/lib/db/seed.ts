import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "reps.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

function seed() {
  const seedDir = path.join(process.cwd(), "seed-data");
  const now = new Date().toISOString();

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      starter_code TEXT NOT NULL,
      solution_code TEXT NOT NULL DEFAULT '',
      test_cases TEXT NOT NULL DEFAULT '[]',
      tier INTEGER NOT NULL DEFAULT 1,
      category_id TEXT NOT NULL REFERENCES categories(id),
      author_id TEXT,
      hints TEXT NOT NULL DEFAULT '[]',
      time_limit INTEGER NOT NULL DEFAULT 300,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problem_patterns (
      problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
      PRIMARY KEY (problem_id, pattern_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      daily_goal INTEGER NOT NULL DEFAULT 10,
      streak_count INTEGER NOT NULL DEFAULT 0,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      problem_id TEXT NOT NULL REFERENCES problems(id),
      code TEXT NOT NULL,
      approach_text TEXT NOT NULL DEFAULT '',
      passed INTEGER NOT NULL DEFAULT 0,
      time_spent INTEGER NOT NULL DEFAULT 0,
      timed_mode INTEGER NOT NULL DEFAULT 0,
      error_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      problem_id TEXT NOT NULL REFERENCES problems(id),
      stability REAL NOT NULL DEFAULT 0,
      difficulty REAL NOT NULL DEFAULT 0,
      due TEXT NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      state INTEGER NOT NULL DEFAULT 0,
      last_review TEXT
    );

    CREATE TABLE IF NOT EXISTS user_tier_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT NOT NULL REFERENCES categories(id),
      current_tier INTEGER NOT NULL DEFAULT 1,
      tier_unlocked_at TEXT NOT NULL,
      consecutive_pass INTEGER NOT NULL DEFAULT 0,
      last_decay_check TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_problem_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      original_problem_id TEXT NOT NULL REFERENCES problems(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      starter_code TEXT NOT NULL,
      solution_code TEXT NOT NULL DEFAULT '',
      test_cases TEXT NOT NULL DEFAULT '[]',
      hints TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_items (
      id TEXT PRIMARY KEY,
      share_code TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL REFERENCES users(id),
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problem_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problem_set_items (
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (problem_set_id, problem_id)
    );
  `);

  // Seed categories
  const categoriesData = JSON.parse(
    fs.readFileSync(path.join(seedDir, "categories.json"), "utf-8")
  );
  for (const cat of categoriesData) {
    db.insert(schema.categories)
      .values(cat)
      .onConflictDoNothing()
      .run();
  }
  console.log(`Seeded ${categoriesData.length} categories`);

  // Seed patterns
  const patternsData = JSON.parse(
    fs.readFileSync(path.join(seedDir, "patterns.json"), "utf-8")
  );
  for (const pat of patternsData) {
    db.insert(schema.patterns)
      .values(pat)
      .onConflictDoNothing()
      .run();
  }
  console.log(`Seeded ${patternsData.length} patterns`);

  // Seed problems
  const problemsDir = path.join(seedDir, "problems");
  const problemFiles = fs.readdirSync(problemsDir).filter((f) => f.endsWith(".json"));
  let problemCount = 0;

  for (const file of problemFiles) {
    const data = JSON.parse(
      fs.readFileSync(path.join(problemsDir, file), "utf-8")
    );
    const { patterns: patternIds, ...problem } = data;

    db.insert(schema.problems)
      .values({
        ...problem,
        testCases: JSON.stringify(problem.testCases),
        hints: JSON.stringify(problem.hints),
        authorId: null,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    // Link patterns
    if (patternIds) {
      for (const patternId of patternIds) {
        db.insert(schema.problemPatterns)
          .values({ problemId: problem.id, patternId })
          .onConflictDoNothing()
          .run();
      }
    }

    problemCount++;
  }
  console.log(`Seeded ${problemCount} problems`);

  // Create default user for Phase 1
  db.insert(schema.users)
    .values({
      id: "default-user",
      name: "Developer",
      email: "dev@reps.local",
      dailyGoal: 10,
      streakCount: 0,
      settings: "{}",
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();
  console.log("Created default user");

  // Create default tier progress for each category
  for (const cat of categoriesData) {
    db.insert(schema.userTierProgress)
      .values({
        id: `utp-default-${cat.id}`,
        userId: "default-user",
        categoryId: cat.id,
        currentTier: 1,
        tierUnlockedAt: now,
        consecutivePass: 0,
        lastDecayCheck: now,
      })
      .onConflictDoNothing()
      .run();
  }
  console.log("Created default tier progress");

  sqlite.close();
  console.log("Seed complete!");
}

seed();
