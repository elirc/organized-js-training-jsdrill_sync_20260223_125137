import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// ─── Categories ───
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Patterns ───
export const patterns = sqliteTable("patterns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  explanation: text("explanation").notNull().default(""),
});

// ─── Problems ───
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

// ─── Problem ↔ Pattern (many-to-many) ───
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

// ─── Users ───
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  dailyGoal: integer("daily_goal").notNull().default(10),
  streakCount: integer("streak_count").notNull().default(0),
  settings: text("settings").notNull().default("{}"), // JSON
  createdAt: text("created_at").notNull(),
});

// ─── Attempts ───
export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  problemId: text("problem_id")
    .notNull()
    .references(() => problems.id),
  code: text("code").notNull(),
  approachText: text("approach_text").notNull().default(""),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  timeSpent: integer("time_spent").notNull().default(0), // seconds
  timedMode: integer("timed_mode", { mode: "boolean" }).notNull().default(false),
  errorType: text("error_type"),
  createdAt: text("created_at").notNull(),
});

// ─── FSRS User Cards (one per user×problem) ───
export const userCards = sqliteTable("user_cards", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  problemId: text("problem_id")
    .notNull()
    .references(() => problems.id),
  stability: real("stability").notNull().default(0),
  difficulty: real("difficulty").notNull().default(0),
  due: text("due").notNull(),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0), // 0=New, 1=Learning, 2=Review, 3=Relearning
  lastReview: text("last_review"),
});

// ─── User Tier Progress (one per user×category) ───
export const userTierProgress = sqliteTable("user_tier_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  currentTier: integer("current_tier").notNull().default(1),
  tierUnlockedAt: text("tier_unlocked_at").notNull(),
  consecutivePass: integer("consecutive_pass").notNull().default(0),
  lastDecayCheck: text("last_decay_check").notNull(),
});

// ─── User Problem Versions (forks of system problems) ───
export const userProblemVersions = sqliteTable("user_problem_versions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  originalProblemId: text("original_problem_id")
    .notNull()
    .references(() => problems.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  starterCode: text("starter_code").notNull(),
  solutionCode: text("solution_code").notNull().default(""),
  testCases: text("test_cases").notNull().default("[]"),
  hints: text("hints").notNull().default("[]"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Shared Items ───
export const sharedItems = sqliteTable("shared_items", {
  id: text("id").primaryKey(),
  shareCode: text("share_code").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  itemType: text("item_type").notNull(), // "problem" | "problem_set"
  itemId: text("item_id").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Problem Sets ───
export const problemSets = sqliteTable("problem_sets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

// ─── Problem Set Items ───
export const problemSetItems = sqliteTable(
  "problem_set_items",
  {
    problemSetId: text("problem_set_id")
      .notNull()
      .references(() => problemSets.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.problemSetId, table.problemId] })]
);
