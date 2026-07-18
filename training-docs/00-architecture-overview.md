# Reps — System Architecture Overview

## What Is This Application?

**Reps** is a spaced repetition coding practice platform designed to build JavaScript fluency for software engineering interviews. Think of it as "Anki meets LeetCode" — instead of browsing a list of problems and picking what to practice, the system uses a scientifically-backed algorithm (FSRS) to decide what you should practice and when.

### Core Philosophy
- **One problem at a time** — No browsing, no choice paralysis
- **Algorithm-driven practice** — The FSRS spaced repetition algorithm schedules reviews at optimal intervals
- **Pattern-based learning** — Problems are tagged with coding patterns (Two Pointers, Hash Map, Recursion, etc.)
- **Progressive difficulty** — 5 tiers per category, unlocked through demonstrated mastery (4 consecutive passes)

---

## Tech Stack

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| **Framework** | Next.js 16 (App Router) | Full-stack in one codebase — React frontend + API routes + SSR |
| **Language** | TypeScript | Type safety across frontend and backend |
| **UI** | React 19 + Tailwind CSS | Component-based UI with utility-first styling |
| **Code Editor** | CodeMirror 6 | Modular, ~150KB (vs Monaco at 2-4MB) |
| **Database** | SQLite via better-sqlite3 | Zero-config, file-based, no server process needed |
| **ORM** | Drizzle | Type-safe SQL builder, lightweight, excellent SQLite support |
| **Spaced Repetition** | ts-fsrs | Modern FSRS algorithm, better than SM-2, JavaScript-native |
| **ID Generation** | uuid v4 | Globally unique, no DB coordination needed |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Drill Page   │  │  Dashboard   │  │  Admin Pages │             │
│  │  (app/page)   │  │  Page        │  │  (CRUD)      │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
│  ┌──────┴───────┐         │                  │                      │
│  │ Code Executor│         │                  │                      │
│  │ (client-side)│         │                  │                      │
│  └──────────────┘         │                  │                      │
└─────────────┬─────────────┴──────────────────┴──────────────────────┘
              │              │                  │
              │  HTTP API (fetch)               │
              ▼              ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER (Next.js API Routes)                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ /api/session  │  │/api/dashboard│  │/api/problems │             │
│  │ /api/attempts │  │              │  │/api/categories│            │
│  └──────┬───────┘  └──────┬───────┘  │/api/patterns │             │
│         │                  │          └──────┬───────┘             │
│  ┌──────┴───────────────────┴────────────────┴──────┐              │
│  │              Business Logic Layer                 │              │
│  │  ┌─────────────────┐  ┌────────────────┐        │              │
│  │  │ sessionBuilder   │  │  fsrs.ts       │        │              │
│  │  │ (queue builder)  │  │  (scheduling)  │        │              │
│  │  └─────────────────┘  └────────────────┘        │              │
│  │  ┌─────────────────┐  ┌────────────────┐        │              │
│  │  │ utils.ts         │  │  types/index   │        │              │
│  │  │ (shared helpers) │  │  (type defs)   │        │              │
│  │  └─────────────────┘  └────────────────┘        │              │
│  └───────────────────────────┬──────────────────────┘              │
│                              │                                      │
│  ┌───────────────────────────┴──────────────────────┐              │
│  │              Data Layer (Drizzle ORM)             │              │
│  │  ┌─────────────┐  ┌──────────────────┐          │              │
│  │  │ db/index.ts  │  │ db/schema.ts     │          │              │
│  │  │ (connection)  │  │ (12 tables)      │          │              │
│  │  └─────────────┘  └──────────────────┘          │              │
│  └───────────────────────────┬──────────────────────┘              │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │      reps.db        │
                    │   (SQLite file)     │
                    └─────────────────────┘
```

---

## The 12 Database Tables

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  categories  │◄────│   problems   │────►│    patterns      │
│             │     │              │     │                 │
│  id         │     │  id          │     │  id             │
│  name       │     │  title       │     │  name           │
│  description│     │  description │     │  slug           │
│  icon       │     │  starterCode │     │  description    │
│  sortOrder  │     │  solutionCode│     │  explanation    │
└─────────────┘     │  testCases   │     └─────────────────┘
                    │  tier        │              ▲
                    │  categoryId──┘              │
                    │  authorId    │     ┌────────┴────────┐
                    │  hints       │     │ problemPatterns  │
                    │  timeLimit   │     │  (junction)      │
                    │  isPublished │     │  problemId       │
                    │  createdAt   │     │  patternId       │
                    │  updatedAt   │     └─────────────────┘
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
    │   attempts   │ │ userCards │ │ userTierProgress  │
    │              │ │  (FSRS)  │ │                    │
    │  id          │ │  id      │ │  id                │
    │  userId      │ │  userId  │ │  userId            │
    │  problemId   │ │ problemId│ │  categoryId        │
    │  code        │ │ stability│ │  currentTier       │
    │  approachText│ │difficulty│ │  consecutivePass   │
    │  passed      │ │  due     │ │  tierUnlockedAt    │
    │  timeSpent   │ │  reps    │ │  lastDecayCheck    │
    │  timedMode   │ │  lapses  │ └──────────────────┘
    │  errorType   │ │  state   │
    │  createdAt   │ │lastReview│
    └──────────────┘ └──────────┘

    ┌──────────┐  ┌─────────────────────┐  ┌──────────────┐
    │  users   │  │ userProblemVersions  │  │  sharedItems │
    │          │  │  (user forks)        │  │              │
    │  id      │  │  id                  │  │  id          │
    │  name    │  │  userId              │  │  shareCode   │
    │  email   │  │  originalProblemId   │  │  ownerId     │
    │ dailyGoal│  │  title, code, etc.   │  │  itemType    │
    │  streak  │  └─────────────────────┘  │  itemId      │
    │ settings │                            └──────────────┘
    │ createdAt│  ┌─────────────┐  ┌──────────────────┐
    └──────────┘  │ problemSets │  │ problemSetItems   │
                  │             │  │  (junction)       │
                  │  id         │  │  problemSetId     │
                  │  userId     │  │  problemId        │
                  │  name       │  │  sortOrder        │
                  │ description │  └──────────────────┘
                  │  createdAt  │
                  └─────────────┘
```

### Table Relationships
- **`problems` → `categories`**: Each problem belongs to one category (many-to-one)
- **`problems` ↔ `patterns`**: Many-to-many via `problemPatterns` junction table
- **`attempts` → `problems`/`users`**: Each attempt links to one user and one problem
- **`userCards` → `problems`/`users`**: One FSRS card per user-problem pair
- **`userTierProgress` → `categories`/`users`**: One tier progress per user-category pair

---

## The Three Core Workflows

### 1. The Drill Session Flow (The Main Loop)

This is the primary user experience — the path a user takes when they practice:

```
User opens /app (Drill Page)
       │
       ▼
┌──────────────────────────┐
│  GET /api/session?size=10 │ ──► sessionBuilder.ts
│  (Fetch problem queue)    │     ├── Query overdue userCards (60% of session)
└──────────┬───────────────┘     ├── Query new unlocked problems (40%)
           │                      ├── Enrich with category/pattern data
           ▼                      └── Shuffle and return
┌──────────────────────────┐
│  Phase 1: APPROACH        │  User explains their approach in text
│  (ApproachPrompt)         │
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Phase 2: CODING          │  User writes code in CodeMirror editor
│  (CodeEditor)             │
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Phase 3: RUN TESTS       │  Client-side execution via executor.ts
│  (executeUserCode)        │  ├── new Function() runs user code
│                           │  ├── Compare results with deepEqual
│                           │  └── Classify errors (7 types)
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Phase 4: RESULTS         │  Show pass/fail for each test case
│  (TestResults)            │
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Phase 5: SUBMIT          │ ──► POST /api/attempts
│  (Record attempt)         │     ├── Insert attempt record
│                           │     ├── Get/create FSRS card
│                           │     ├── scheduleNext() → new due date
│                           │     └── updateTierProgress()
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│  Phase 6: POST-SOLVE      │  Pattern reveal, related problems
│  (PostSolve)              │
└──────────┬───────────────┘
           ▼
    Next problem or Session Complete
```

### 2. The Spaced Repetition Cycle

This is the feedback loop that makes learning effective:

```
                    ┌──────────────────────┐
                    │   User attempts a    │
                    │      problem         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  POST /api/attempts   │
                    │  Records: pass/fail,  │
                    │  time, error type     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    fsrs.ts rates     │
                    │    the attempt:      │
                    │                      │
                    │  Failed → Again      │
                    │  Slow pass → Hard    │
                    │  Normal pass → Good  │
                    │  Fast pass → Easy    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  FSRS calculates     │
                    │  next review date    │
                    │  (stored in          │
                    │   userCards.due)     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Time passes...       │
                    │  Card becomes overdue │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  sessionBuilder sees  │
                    │  overdue card, adds   │
                    │  to next session      │
                    └──────────┬───────────┘
                               │
                    └───────── loops back ──┘
```

**Rating Thresholds:**
| Scenario | Rating | Next Review |
|----------|--------|-------------|
| Failed | Again | Minutes to hours |
| Passed, timed mode, >80% of time limit | Hard | 1-2 days |
| Passed, <40% of time limit | Easy | Weeks to months |
| Passed, 40-80% of time limit | Good | Days to weeks |

### 3. The Tier Progression System

This gates content difficulty:

```
Category: Arrays
  Tier 1 (Foundation) ─── Unlocked by default
       │
       │  4 consecutive passes at T1
       ▼
  Tier 2 (Combination) ── Unlocked!
       │
       │  4 consecutive passes at T2
       ▼
  Tier 3 (Edge-Aware) ─── Unlocked!
       │
       │  ...continues to T5
       ▼
  Tier 5 (Interview-Ready) ── Maximum tier
```

The session builder respects tier gates: if a user is at Tier 2 in Arrays, they'll only see Tier 1 and Tier 2 Array problems for new (unseen) problems. Review problems are always included regardless of tier.

---

## How the Files Fit Together

### File Dependency Graph

```
types/index.ts ◄──────────── Used by everything
       ▲
       │
lib/utils.ts ◄───────────── Used by API routes + executor
       ▲
       │
lib/db/schema.ts ◄───────── Defines all tables
       ▲
       │
lib/db/index.ts ◄────────── Creates DB connection
       ▲                     (imports schema)
       │
       ├────────────────────────────────────────────────┐
       │                    │                            │
lib/fsrs.ts            lib/sessionBuilder.ts       API Routes
(FSRS wrapper)         (queue builder)             (all routes)
       ▲                    ▲                           ▲
       │                    │                            │
       │              api/session/route.ts          api/problems/route.ts
       │                                            api/categories/route.ts
       │                                            api/patterns/route.ts
       │                                            api/dashboard/route.ts
       │
  api/attempts/route.ts ◄── The bridge between
  (records attempts,         drill session and FSRS
   calls scheduleNext)

                    FRONTEND COMPONENTS

app/app/page.tsx ◄────────── The main drill page
  │   (state machine)
  │
  ├── components/drill/SessionProgress.tsx
  ├── components/drill/ProblemCard.tsx
  ├── components/drill/ApproachPrompt.tsx
  ├── components/drill/CodeEditor.tsx  ◄── CodeMirror integration
  ├── components/drill/TestResults.tsx
  ├── components/drill/PostSolve.tsx
  └── lib/executor.ts  ◄── Client-side code execution

app/app/dashboard/page.tsx ◄── Dashboard page
  ├── components/dashboard/HeatMap.tsx
  ├── components/dashboard/CategoryStrength.tsx
  └── components/dashboard/PatternMap.tsx

components/admin/ProblemForm.tsx ◄── Used by admin pages
  └── components/ui/* (Button, Card, Input, Select, Textarea, Badge)
```

### Data Flow Summary

| Flow | Path | What Moves |
|------|------|-----------|
| **Load session** | Drill Page → Session API → sessionBuilder → DB | `SessionProblem[]` |
| **Execute code** | Drill Page → executor.ts (client-side) | `ExecutionResult` |
| **Record attempt** | Drill Page → Attempts API → DB + FSRS | Attempt record + FSRS card update |
| **Load dashboard** | Dashboard Page → Dashboard API → DB | Aggregated stats |
| **Create problem** | ProblemForm → Problems API → DB | Problem record + pattern links |

---

## Recommended Reading Order for Training Docs

To build understanding progressively, read the training docs in this order:

### Phase 1: Foundation (Understand the Data)
1. **`01-schema.md`** — The database schema. Everything starts here.
2. **`07-types.md`** — TypeScript types that mirror and extend the schema.
3. **`15-database-connection.md`** — How the app connects to SQLite.
4. **`14-utils.md`** — Shared utilities used everywhere.

### Phase 2: Core Algorithm (Understand the Brain)
5. **`06-fsrs.md`** — The spaced repetition algorithm.
6. **`02-session-builder.md`** — How drill sessions are constructed.
7. **`04-executor.md`** — How user code is executed and tested.

### Phase 3: API Layer (Understand the Backend)
8. **`08-session-api.md`** — Thin route, delegates to session builder.
9. **`05-attempts-api.md`** — The most important API route.
10. **`09-problems-api.md`** — CRUD for problems.
11. **`10-dashboard-api.md`** — Complex data aggregation.

### Phase 4: Frontend (Understand the UI)
12. **`03-drill-page.md`** — The main drill interface (state machine).
13. **`12-code-editor.md`** — CodeMirror integration.
14. **`11-dashboard-page.md`** — Dashboard data fetching and rendering.
15. **`13-problem-form.md`** — Complex form patterns.

---

## Key Architectural Patterns Used

| Pattern | Where | Why |
|---------|-------|-----|
| **State Machine** | Drill page phases | Manages complex multi-step UI flow |
| **Thin Controller / Fat Service** | API routes + business logic | Separates HTTP from domain logic |
| **Module Singleton** | db/index.ts | One DB connection shared app-wide |
| **Facade** | fsrs.ts wrapping ts-fsrs | Isolates third-party library |
| **Data Transfer Object (DTO)** | SessionProblem type | Shapes data for frontend needs |
| **Junction Table** | problemPatterns | Many-to-many relationships |
| **Get-or-Create** | Attempts API + FSRS cards | Handles first-time and returning users |
| **Guard Clause** | Early returns throughout | Handles errors before happy path |
| **Callback Ref** | CodeEditor's onChangeRef | Bridges React and imperative APIs |
| **Controlled Components** | ProblemForm inputs | React owns form state |

---

## File Count Summary

| Category | Count | Files |
|----------|-------|-------|
| **Training docs created for** | **15** | The top ~35% most important files |
| Pages & Layouts | 12 | App pages, admin pages, layouts |
| API Routes | 7 | Session, attempts, problems, dashboard, categories, patterns |
| Drill Components | 6 | ProblemCard, CodeEditor, TestResults, etc. |
| Dashboard Components | 3 | HeatMap, CategoryStrength, PatternMap |
| Admin Components | 1 | ProblemForm |
| UI Primitives | 6 | Button, Card, Badge, Input, Select, Textarea |
| Library/Logic | 7 | db, schema, fsrs, executor, sessionBuilder, utils, seed |
| Types | 1 | Shared type definitions |
| **Total Source Files** | **43** | |
