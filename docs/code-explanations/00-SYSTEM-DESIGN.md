# Reps — System Design Overview

Hey, welcome to the codebase. This doc walks you through how the entire system fits together so you can orient yourself before diving into individual files. Read this first, then look at whichever file explanations interest you.

---

## What This App Does (The 30-Second Pitch)

Reps is a spaced repetition coding drill app. Users see one coding problem at a time, write their approach in plain English, then write code, run it against test cases, and get feedback. Behind the scenes, the FSRS algorithm tracks how well they know each problem and schedules reviews at optimal intervals — problems they struggle with come back sooner, easy ones get pushed out further.

---

## The Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                       │
│                                                               │
│  Landing Page (/)                                             │
│  ├── App Shell (/app/*)          ← user-facing                │
│  │   ├── Drill Page (/app)       ← the core loop              │
│  │   ├── Dashboard (/app/dashboard)                           │
│  │   └── Patterns (/app/patterns)                             │
│  └── Admin Shell (/admin/*)      ← content management         │
│      ├── Problem List (/admin)                                │
│      ├── Problem Form (new/edit)                              │
│      ├── Categories (/admin/categories)                       │
│      └── Patterns (/admin/patterns)                           │
│                                                               │
│  Client-Side Libraries:                                       │
│  ├── CodeMirror 6       (code editor)                         │
│  ├── executor.ts        (runs user code in sandboxed scope)   │
│  └── utils.ts           (deepEqual, helpers)                  │
├───────────────────────── HTTP ────────────────────────────────┤
│                        SERVER (Next.js API Routes)            │
│                                                               │
│  /api/session      → builds a drill session (FSRS + tiers)   │
│  /api/attempts     → records attempts, updates FSRS cards     │
│  /api/problems     → CRUD for problems                        │
│  /api/problems/[id]→ single problem CRUD                      │
│  /api/categories   → CRUD for categories                      │
│  /api/patterns     → CRUD for patterns                        │
│  /api/dashboard    → aggregated stats for the dashboard       │
│                                                               │
│  Server Libraries:                                            │
│  ├── sessionBuilder.ts  (decides what you practice next)      │
│  ├── fsrs.ts            (spaced repetition wrapper)           │
│  └── db/                (Drizzle ORM + SQLite)                │
├───────────────────────── SQL ─────────────────────────────────┤
│                        DATABASE (SQLite via better-sqlite3)   │
│                                                               │
│  10 tables — see schema.ts explanation for full details       │
│  Key relationships:                                           │
│  ├── problems ←→ patterns (many-to-many via join table)       │
│  ├── problems → categories (many-to-one)                      │
│  ├── attempts → users, problems (foreign keys)                │
│  ├── user_cards → users, problems (FSRS state per pair)       │
│  └── user_tier_progress → users, categories (tier per pair)   │
└──────────────────────────────────────────────────────────────┘
```

---

## Why These Technology Choices?

### Next.js 14 (App Router)
Next.js gives us a unified framework: React pages on the front end, API routes on the back end, all in one codebase. The App Router is the modern way Next.js handles routing — each folder under `src/app/` becomes a URL path, and `page.tsx` in that folder becomes the page component. `layout.tsx` wraps child routes with shared UI (like navigation).

**Why this matters to you:** When you want to add a new page, you just create a folder + `page.tsx`. When you want a new API endpoint, you create a folder + `route.ts` under `src/app/api/`. The framework handles routing, bundling, server-side rendering — you focus on the logic.

### SQLite (via better-sqlite3) + Drizzle ORM
We use SQLite instead of PostgreSQL because:
- Zero configuration — it's just a file (`reps.db`) in the project root
- No external service to set up or pay for
- Perfectly fast for a single-user or small-team local app
- Easy to reset: delete the file, re-run the seed

Drizzle ORM sits on top: it gives us type-safe queries that look like SQL but catch errors at compile time. When you write `db.select().from(schema.problems).where(eq(...))`, TypeScript knows exactly what columns exist and what types they return.

### CodeMirror 6 (not Monaco)
Monaco is the editor from VS Code — it's amazing but 2-4MB bundled. For typing 10-30 line solutions, that's absurd overkill. CodeMirror 6 is ~150KB, modular (you pick which features to include), and gives us syntax highlighting, bracket matching, keyboard shortcuts, and undo/redo. That's all we need.

### FSRS (Free Spaced Repetition Scheduler)
FSRS is the modern replacement for the SM-2 algorithm used in Anki. It's been proven to produce better recall rates. The `ts-fsrs` package gives us a JavaScript implementation. Each problem a user has seen gets a "card" with stability (how well they know it) and a due date (when to review it next).

### Client-Side Code Execution
User code runs directly in the browser via `new Function()`. This is a deliberate V1 choice:
- No server sandbox needed (no Docker, no Piston API, no Lambda)
- Instant feedback (no network roundtrip to execute)
- Security is acceptable because the user is running their own code in their own browser

The tradeoff: we can only run JavaScript. Multi-language support (Python, etc.) would require server-side execution in V2.

---

## The Core User Flow (Data Flow)

Here's what happens when a user does a drill session, step by step:

### 1. Session Starts
```
Browser → GET /api/session?size=10
  └── sessionBuilder.ts runs:
      1. Queries user_cards for overdue reviews (due <= now)
      2. Takes up to 60% from overdue reviews
      3. Fills remaining 40% with new problems from unlocked tiers
      4. Shuffles to avoid category clustering
      5. Enriches each problem with category name + pattern data
  └── Returns array of SessionProblem objects
```

### 2. User Writes Approach
The approach text is stored in React state. The editor is gated — it only appears after the user writes at least 10 characters. This enforces the "think first" habit.

### 3. User Writes Code + Runs Tests
```
Browser (client-side only — no server involved):
  └── executor.ts runs:
      1. Extracts function name from user code via regex
      2. Wraps code in `new Function()` to create a sandboxed scope
      3. Calls the function with each test case's input
      4. Compares output to expected using deep equality
      5. Classifies any errors (edge-case-miss, off-by-one, etc.)
  └── Returns ExecutionResult with pass/fail per test
```

### 4. User Submits
```
Browser → POST /api/attempts
  └── Server does 4 things:
      1. Inserts an `attempt` row (permanent record of what they submitted)
      2. Gets or creates the FSRS `user_card` for this user×problem pair
      3. Feeds the result into FSRS → gets updated card with new due date
      4. Updates tier progress (consecutive passes → tier promotion)
  └── Returns the FSRS rating and next review date
```

### 5. Post-Solve Screen
The browser shows the pattern tags (previously hidden), the user's approach text, and hints if they failed. Then "Next Problem →" advances to the next problem in the session.

---

## The Data Model Philosophy

### Why Relational (not NoSQL)?
The data has clear, rigid relationships: problems belong to categories, problems link to patterns, attempts belong to users and problems. A relational database enforces these constraints at the database level. You can't accidentally create an attempt for a problem that doesn't exist.

### The Content Ownership Model
- **`authorId = null`** → System/dev problem, visible to everyone
- **`authorId = <userId>`** → User-created problem, private to them
- **`user_problem_versions`** → User's fork of a system problem (personal notes/edits)
- **`shared_items`** → Makes a problem or set accessible via a short share code

This is a clean separation. The same `problems` table holds both system and user content, differentiated by a single nullable column. No need for separate tables.

### Why JSON Columns for Test Cases and Hints?
Test cases and hints are arrays of structured data, but they're always read and written as a whole unit — you never query "find all problems where test case #3 has input [1,2,3]". Storing them as JSON in a TEXT column is pragmatic: simpler schema, no join tables, easy to serialize/deserialize.

The tradeoff: you can't do SQL queries against individual test cases. That's fine — we never need to.

---

## The Folder Structure Logic

```
src/
├── app/           ← Next.js pages and API routes (the "surface area")
│   ├── app/       ← User-facing pages (drill, dashboard, patterns)
│   ├── admin/     ← Content management pages
│   └── api/       ← Backend API endpoints
├── components/    ← Reusable React components
│   ├── drill/     ← Components for the drill experience
│   ├── dashboard/ ← Components for the stats dashboard
│   ├── admin/     ← Components for the admin interface
│   └── ui/        ← Generic UI primitives (Button, Card, Input, etc.)
├── lib/           ← Business logic and utilities (the "engine")
│   └── db/        ← Database connection, schema, and seed
└── types/         ← Shared TypeScript type definitions
```

**The key principle:** Pages (`app/`) are thin — they wire components together and call APIs. Components (`components/`) handle presentation. Libraries (`lib/`) handle business logic. Types (`types/`) are shared across all three layers.

When you want to change *how something looks*, edit a component. When you want to change *how something works*, edit a library. When you want to change *what URL something lives at*, edit the `app/` folder structure.

---

## How to Extend This

### Adding a New Problem Category
1. Add a JSON entry in `seed-data/categories.json`
2. Run `npm run db:seed` (idempotent — won't duplicate)
3. Or use the admin UI at `/admin/categories`

### Adding New Problems
1. Create a JSON file in `seed-data/problems/` (follow existing format)
2. Run `npm run db:seed`
3. Or use the admin UI at `/admin/problems/new`

### Adding a New Pattern
1. Add to `seed-data/patterns.json` or use `/admin/patterns`
2. Link it to problems in the admin problem form

### Adding a New API Endpoint
1. Create `src/app/api/your-endpoint/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` functions
3. Use `db` from `@/lib/db` for database queries

### Adding a New Page
1. Create `src/app/app/your-page/page.tsx` (for user-facing)
2. Or `src/app/admin/your-page/page.tsx` (for admin)
3. It automatically inherits the corresponding layout's navigation

---

## Things to Watch Out For

1. **The seed script is idempotent** — `onConflictDoNothing()` means running it twice won't create duplicates. But it also won't *update* existing rows. If you change a seed file, you need to either delete the DB first (`npm run db:reset`) or use the admin UI.

2. **Client-side execution is not secure against malicious code** — but it doesn't need to be. The user is running their own code in their own browser. It's no different from opening the browser console.

3. **The default user (`default-user`) is a Phase 1 shortcut** — all data belongs to this user. When auth is added later, the schema already supports multiple users via `userId` foreign keys on every relevant table.

4. **JSON columns need manual parse/stringify** — when you read `testCases` from the database, it's a string. You must `JSON.parse()` it. When you write it, you must `JSON.stringify()`. The schema type says `text` because SQLite doesn't have a JSON type. Drizzle doesn't auto-convert.

5. **FSRS state is opaque** — don't try to manually set stability/difficulty values. Always go through the `scheduleNext()` function in `fsrs.ts`. The algorithm's internal math depends on all fields being consistent.
