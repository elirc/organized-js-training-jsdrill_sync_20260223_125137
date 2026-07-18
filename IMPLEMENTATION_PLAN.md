# Reps — Spaced Repetition Coding Drills
## Final Implementation Plan

---

## 1. Product Overview

Reps is a web app that uses spaced repetition to build coding fluency for software engineering interviews. It focuses on fundamental patterns (array manipulation, string operations, object traversal, recursion) rather than LeetCode-style algorithm puzzles.

### Core Principles
- **One problem at a time** — no browsing, no choice paralysis
- **Algorithm-driven practice** — spaced repetition picks optimal review + new problems
- **Patterns over problems** — recognize shapes, don't memorize solutions
- **Maintainable & extendable** — clean architecture for ongoing development

---

## 2. Content Ownership Model

### Three Types of Problems
1. **System Problems** (`authorId = null`) — Created by the dev, visible to ALL users. Loaded via seed files or admin UI.
2. **User Problems** (`authorId = <userId>`) — Created by a user, visible only to them by default.
3. **User Modifications** — Users can fork/modify any system problem into their own version (`UserProblemVersion` table). Their version is private.

### Sharing
- Users can **share individual problems** or **problem sets** with other users via share links.
- Shared content is read-only for recipients unless they fork it.

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | SSR, API routes, file-based routing |
| Language | TypeScript | Type safety for data models |
| Code Editor | CodeMirror 6 | ~150KB, modular, lightweight |
| Database | SQLite (via better-sqlite3 + Drizzle) | Zero config, local-first, no external service needed |
| ORM | Drizzle ORM | Lightweight, type-safe, SQL-like |
| Auth | Skipped for Phase 1 | Simple user switcher for local dev; add NextAuth later |
| Code Execution | Client-side sandboxed `Function()` | JS only, no server sandbox needed |
| AI Integration | None for V1 | Dev uses Claude Code / OpenAI Codex to generate problems offline, loads via files/admin |
| SR Algorithm | FSRS (ts-fsrs) | Modern, open-source, better than SM-2, JS-native |
| Styling | Tailwind CSS | Fast iteration, consistent design |
| Deployment | Vercel (later) | Natural fit for Next.js |

---

## 4. Data Model

### Tables

#### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| name | TEXT | e.g., "Strings", "Arrays" |
| description | TEXT | |
| icon | TEXT | Emoji or icon name |
| sortOrder | INTEGER | Display ordering |

#### `patterns`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| name | TEXT | e.g., "Hash Map Lookup" |
| slug | TEXT | e.g., "hash-lookup" |
| description | TEXT | Short explanation |
| explanation | TEXT | Longer teaching explanation |

#### `problems`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| title | TEXT | |
| description | TEXT | Problem statement |
| starterCode | TEXT | Function signature/skeleton |
| solutionCode | TEXT | Reference solution |
| testCases | TEXT (JSON) | Array of TestCase objects |
| tier | INTEGER (1-5) | Difficulty tier |
| categoryId | TEXT | FK → categories |
| authorId | TEXT | FK → users, NULL = system problem |
| hints | TEXT (JSON) | Array of hint strings |
| timeLimit | INTEGER | Seconds allowed in timed mode |
| isPublished | INTEGER (bool) | Whether visible in drill rotation |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

#### `problem_patterns` (join table)
| Column | Type | Notes |
|--------|------|-------|
| problemId | TEXT | FK → problems |
| patternId | TEXT | FK → patterns |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| name | TEXT | Display name |
| email | TEXT | Unique |
| dailyGoal | INTEGER | 5, 10, or 15 |
| streakCount | INTEGER | Current streak |
| settings | TEXT (JSON) | Preferences |
| createdAt | TEXT | ISO timestamp |

#### `attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| userId | TEXT | FK → users |
| problemId | TEXT | FK → problems |
| code | TEXT | User's submitted code |
| approachText | TEXT | "Explain your approach" text |
| passed | INTEGER (bool) | |
| timeSpent | INTEGER | Seconds |
| timedMode | INTEGER (bool) | |
| errorType | TEXT | Classified error type |
| createdAt | TEXT | ISO timestamp |

#### `user_cards` (FSRS state, one per user×problem)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| userId | TEXT | FK → users |
| problemId | TEXT | FK → problems |
| stability | REAL | FSRS stability |
| difficulty | REAL | FSRS difficulty |
| due | TEXT | ISO timestamp — next review |
| reps | INTEGER | Review count |
| lapses | INTEGER | Failure count |
| state | INTEGER | FSRS state enum |
| lastReview | TEXT | ISO timestamp |

#### `user_tier_progress` (one per user×category)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| userId | TEXT | FK → users |
| categoryId | TEXT | FK → categories |
| currentTier | INTEGER | 1-5 |
| tierUnlockedAt | TEXT | ISO timestamp |
| consecutivePass | INTEGER | |
| lastDecayCheck | TEXT | ISO timestamp |

#### `user_problem_versions` (user forks of system problems)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| userId | TEXT | FK → users |
| originalProblemId | TEXT | FK → problems |
| title | TEXT | Modified title |
| description | TEXT | Modified description |
| starterCode | TEXT | Modified starter |
| solutionCode | TEXT | User's reference solution |
| testCases | TEXT (JSON) | Modified test cases |
| hints | TEXT (JSON) | Modified hints |
| notes | TEXT | User's personal notes |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

#### `shared_items` (sharing problems/sets)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| shareCode | TEXT | Unique short code for URL |
| ownerId | TEXT | FK → users |
| itemType | TEXT | "problem" or "problem_set" |
| itemId | TEXT | FK → problems or problem set ID |
| createdAt | TEXT | ISO timestamp |

#### `problem_sets` (user-curated collections)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | PK |
| userId | TEXT | FK → users |
| name | TEXT | |
| description | TEXT | |
| createdAt | TEXT | ISO timestamp |

#### `problem_set_items` (join table)
| Column | Type | Notes |
|--------|------|-------|
| problemSetId | TEXT | FK → problem_sets |
| problemId | TEXT | FK → problems |
| sortOrder | INTEGER | |

---

## 5. Project Structure

```
reps/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with nav
│   │   ├── page.tsx                    # Landing page
│   │   ├── globals.css                 # Tailwind + global styles
│   │   ├── app/
│   │   │   ├── layout.tsx              # App shell layout
│   │   │   ├── page.tsx                # Main drill interface
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Stats dashboard
│   │   │   └── patterns/
│   │   │       └── page.tsx            # Pattern browser
│   │   ├── admin/
│   │   │   ├── page.tsx                # Admin: problem list
│   │   │   ├── problems/
│   │   │   │   ├── new/page.tsx        # Create problem
│   │   │   │   └── [id]/edit/page.tsx  # Edit problem
│   │   │   ├── categories/page.tsx     # Manage categories
│   │   │   └── patterns/page.tsx       # Manage patterns
│   │   └── api/
│   │       ├── problems/route.ts       # CRUD problems
│   │       ├── categories/route.ts     # CRUD categories
│   │       ├── patterns/route.ts       # CRUD patterns
│   │       ├── attempts/route.ts       # Record attempts
│   │       ├── session/route.ts        # Build drill session
│   │       ├── user/route.ts           # User profile/settings
│   │       └── share/route.ts          # Share/import
│   ├── components/
│   │   ├── drill/
│   │   │   ├── ProblemCard.tsx          # Problem display
│   │   │   ├── ApproachPrompt.tsx       # "Explain your approach"
│   │   │   ├── CodeEditor.tsx           # CodeMirror wrapper
│   │   │   ├── TestResults.tsx          # Pass/fail display
│   │   │   ├── PostSolve.tsx            # Pattern reveal + feedback
│   │   │   └── SessionProgress.tsx      # Top progress bar
│   │   ├── dashboard/
│   │   │   ├── HeatMap.tsx
│   │   │   ├── CategoryStrength.tsx
│   │   │   └── PatternMap.tsx
│   │   ├── admin/
│   │   │   ├── ProblemForm.tsx          # Create/edit problem form
│   │   │   ├── CategoryForm.tsx
│   │   │   └── PatternForm.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Input.tsx
│   │       ├── Textarea.tsx
│   │       ├── Select.tsx
│   │       └── Modal.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts                # DB connection (better-sqlite3)
│   │   │   ├── schema.ts               # Drizzle schema
│   │   │   └── seed.ts                 # Seed script
│   │   ├── fsrs.ts                     # FSRS wrapper + tier logic
│   │   ├── executor.ts                 # Client-side code runner
│   │   ├── errorClassifier.ts          # Classify failure types
│   │   ├── sessionBuilder.ts           # Build session queue
│   │   └── utils.ts                    # Shared utilities
│   └── types/
│       └── index.ts                    # Shared TypeScript types
├── seed-data/
│   ├── categories.json                 # Category definitions
│   ├── patterns.json                   # Pattern definitions
│   └── problems/                       # One JSON file per problem
│       ├── strings-t1-reverse-string.json
│       ├── strings-t1-count-vowels.json
│       ├── arrays-t1-find-max.json
│       └── ... (20 starter problems)
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.local
├── .gitignore
└── IMPLEMENTATION_PLAN.md
```

---

## 6. Build Order

### Step 1: Project Scaffold
- Initialize Next.js 14 with TypeScript + Tailwind
- Install dependencies (drizzle-orm, better-sqlite3, ts-fsrs, @codemirror/*)
- Configure Drizzle for SQLite
- Set up project structure

### Step 2: Database Schema + Seed Data
- Define all Drizzle schemas
- Create seed data JSON files (categories, patterns, 20 problems)
- Write seed script
- Run migrations + seed

### Step 3: Shared UI Components
- Build reusable UI primitives (Button, Card, Badge, Input, etc.)
- Build root layout with navigation

### Step 4: Admin Interface
- Problem list page with create/edit/delete
- Problem form (title, description, starter code, solution, test cases, tier, category, patterns)
- Category management
- Pattern management

### Step 5: Core Drill Loop
- Problem card display
- "Explain Your Approach" step with gate
- CodeMirror editor integration
- Client-side code executor + test runner
- Test results display
- Post-solve screen (pattern reveal, related problems)

### Step 6: Spaced Repetition + Sessions
- FSRS integration with UserCard persistence
- Session queue builder (review + new mix)
- Tier progression logic
- Session progress bar + daily goal
- Tier decay detection

### Step 7: Dashboard
- Activity heat map
- Category strength meters
- Pattern map visualization

### Step 8: User Content + Sharing
- User problem creation (reuse admin form)
- Fork/modify system problems
- Problem sets (curated collections)
- Share via link (problems + sets)

---

## 7. Seed Problems (20 Starter)

### Strings (T1-T2)
1. Reverse a String (T1)
2. Count Vowels (T1)
3. Most Frequent Character (T2)
4. Is Palindrome (T2)

### Arrays (T1-T2)
5. Find the Maximum (T1)
6. Sum All Elements (T1)
7. Two Sum (T2)
8. Merge Two Sorted Arrays (T2)

### Objects/Maps (T1-T2)
9. Count Word Frequency (T1)
10. Access Nested Property (T1)
11. Invert Key/Values (T2)
12. Deep Merge Two Objects (T2)

### Recursion (T1-T2)
13. Factorial (T1)
14. Fibonacci (T1)
15. Flatten Array (T2)
16. Deep Object Search (T2)

### Sorting/Searching (T1-T2)
17. Find Minimum (T1)
18. Binary Search (T1)
19. Merge Sort (T2)
20. Count Inversions (T2)

---

## 8. Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Database | SQLite via better-sqlite3 | Zero config, local-first, no external service |
| Auth | Skipped (Phase 1) | Single default user, add auth later |
| AI | None in app | Dev generates content offline via Claude Code |
| Editor | CodeMirror 6 | 150KB vs Monaco's 2-4MB |
| SR Algorithm | FSRS (ts-fsrs) | Modern, proven, JS-native |
| Code execution | Client-side Function() | JS-only V1, fast feedback |
| Content model | authorId on problems | null = system, set = user — clean separation |
| Admin UI | Dedicated /admin routes | Easy content management for dev |
| Seed data | JSON files in repo | Version-controlled, easy to edit in VS Code |
| Sharing | Short codes / URLs | Simple, no auth needed to view |

---

## 9. Phase 1 User (No Auth)

Since we're skipping auth for Phase 1:
- A single default user is created on first run (`id: "default-user"`)
- All attempts, cards, and progress belong to this user
- The user switcher / auth can be added later without changing the data model
- The `userId` columns are already in place for future multi-user support

---

## 10. Future Phases (Post V1)

- **Auth**: NextAuth.js with GitHub/Google OAuth
- **AI Features**: Claude API for approach evaluation + walkthroughs
- **Multi-language**: Python via server-side sandbox
- **Timed mode**: Countdown timer + differentiated SR scoring
- **Community**: Problem submission, voting, curated sets
- **Mobile**: Responsive design improvements
- **Deployment**: Vercel + persistent DB (Turso/PlanetScale)
