import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ─── Tracks (JavaScript, React, .NET, …) ───
export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default(""),
  accent: text("accent").notNull().default("indigo"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Modules (a topic inside a track) ───
export const modules = sqliteTable(
  "modules",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull().default(""),
    level: text("level").notNull().default("foundation"),
    keyPoints: text("key_points").notNull().default("[]"), // JSON string[]
    interviewAngle: text("interview_angle").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("modules_track_idx").on(t.trackId)]
);

// ─── Items (one drill question) ───
export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    difficulty: integer("difficulty").notNull().default(1),
    frequency: integer("frequency").notNull().default(2),
    tags: text("tags").notNull().default("[]"), // JSON string[]
    prompt: text("prompt").notNull(),
    code: text("code").notNull().default(""),
    language: text("language").notNull().default("js"),
    choices: text("choices").notNull().default("[]"), // JSON string[]
    answer: text("answer").notNull().default("null"), // JSON
    explanation: text("explanation").notNull().default(""),
    followUp: text("follow_up").notNull().default(""),
    keywords: text("keywords").notNull().default("[]"), // JSON string[]
    modelAnswer: text("model_answer").notNull().default(""),
    starterCode: text("starter_code").notNull().default(""),
    solutionCode: text("solution_code").notNull().default(""),
    testCases: text("test_cases").notNull().default("[]"), // JSON TestCase[]
    estSeconds: integer("est_seconds").notNull().default(45),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("items_module_idx").on(t.moduleId),
    index("items_track_idx").on(t.trackId),
  ]
);

// ─── Users ───
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  dailyGoal: integer("daily_goal").notNull().default(20),
  settings: text("settings").notNull().default("{}"), // JSON
  createdAt: text("created_at").notNull(),
});

// ─── Attempts (one answered item) ───
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** JSON-encoded Response */
    response: text("response").notNull().default("null"),
    verdict: text("verdict").notNull().default("incorrect"),
    score: real("score").notNull().default(0),
    rating: integer("rating").notNull().default(1),
    timeSpent: integer("time_spent").notNull().default(0), // seconds
    usedHint: integer("used_hint", { mode: "boolean" }).notNull().default(false),
    /** null for normal drills, or the interview run this belonged to */
    interviewId: text("interview_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("attempts_user_idx").on(t.userId),
    index("attempts_item_idx").on(t.itemId),
    index("attempts_created_idx").on(t.createdAt),
  ]
);

// ─── FSRS cards (one per user × item) ───
export const userCards = sqliteTable(
  "user_cards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    due: text("due").notNull(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: integer("state").notNull().default(0), // 0 New, 1 Learning, 2 Review, 3 Relearning
    lastReview: text("last_review"),
  },
  (t) => [
    index("cards_user_due_idx").on(t.userId, t.due),
    index("cards_user_item_idx").on(t.userId, t.itemId),
  ]
);

// ─── Saved items (star / note) ───
export const savedItems = sqliteTable(
  "saved_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("saved_user_item_idx").on(t.userId, t.itemId)]
);

// ─── Mock interview runs ───
export const interviews = sqliteTable(
  "interviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    trackSlugs: text("track_slugs").notNull().default("[]"), // JSON string[]
    total: integer("total").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    score: real("score").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    /** JSON breakdown by track/tag, for the report card */
    breakdown: text("breakdown").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("interviews_user_idx").on(t.userId)]
);
