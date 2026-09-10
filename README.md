# Ramp

Interview-focused practice for the JavaScript / TypeScript / React / Node and C# / .NET stack —
a structured path from "I can follow a tutorial" to mid-level CRUD web developer.

No LeetCode, no binary trees. The questions are the ones interviewers actually ask about this
stack: how closures work, why your effect runs twice, what N+1 is, which DI lifetime a `DbContext`
needs, when you'd reach for `409` over `400`.

Runs entirely on your machine against a local SQLite file.

## Quick start

```bash
npm install
npm run db:seed     # loads the question bank
npm run dev
```

Then open <http://localhost:3000>.

## What's in it

**296 questions across 7 tracks and 37 modules**, ordered so each builds on the last:

| # | Track | Covers |
|---|-------|--------|
| 1 | JavaScript | Values and coercion, scope and closures, arrays/objects, async and the event loop, modules and prototypes, errors |
| 2 | TypeScript | Annotations and inference, object types and unions, narrowing and guards, generics and utility types, tsconfig in practice |
| 3 | React | Components and keys, state and forms, effects and data fetching, hooks in depth, building a CRUD screen, re-renders and performance |
| 4 | Node & APIs | The runtime, building an HTTP API, REST design, databases and N+1, auth and web security |
| 5 | C# | Types and nullability, classes/interfaces/records, LINQ and deferred execution, async/await and deadlocks, modern C# and exceptions |
| 6 | ASP.NET Core & EF | Web API basics, DI and the middleware pipeline, EF Core, structuring a CRUD service, auth and running it |
| 7 | Web Fundamentals | HTTP and the browser, SQL, git and team workflow, testing, application architecture |

Each module opens with what an interviewer is *really* testing and a checklist of what you should
be able to say, then drills you on it.

### Seven question formats

| Format | What it asks |
|--------|--------------|
| `mcq` | Single correct choice |
| `multi` | Select all that apply, with partial credit |
| `predict` | "What does this log?" — free text, whitespace and quote style ignored |
| `fill` | Complete the blanks in a snippet, inline |
| `order` | Put the steps in the right sequence (middleware, request lifecycle, deploy) |
| `code` | Write JavaScript, run against real tests in a sandboxed worker |
| `explain` | Say it out loud — scored against the concepts a good answer covers, then you rate yourself |

Every answer comes with the reasoning, the trap it was testing, and **the follow-up question an
interviewer would ask next** — which is usually where interviews are actually won or lost.

## How it works

- **Roadmap** (`/learn`) — the seven tracks with per-module mastery. Nothing is locked; the order
  is a recommendation.
- **Practice** (`/drill`) — a daily mix of everything due for review topped up with new material
  from wherever you are on the path. Fully keyboard-driven: number keys select, `Enter` submits and
  moves on, `⌘/Ctrl+Enter` runs code.
- **Mock interview** (`/interview`) — rapid-fire questions weighted towards what gets asked most,
  with no explanations until the end, then a report card naming the topics that let you down.
- **Library** (`/library`) — every question with its answer, searchable and filterable. For the
  night before.
- **Progress** (`/dashboard`) — mastery by track, an activity heat map, and the tags you keep
  getting wrong.

### Scheduling and mastery

Reviews are scheduled with [FSRS](https://github.com/open-spaced-repetition/ts-fsrs). The rating
is derived from whether you were right, how long you took relative to the question's expected time,
and whether you used a hint — except for `explain` items, which you rate yourself.

Mastery per item combines two things: answering correctly at all earns a floor of 40%, and the rest
comes from FSRS stability, which only grows through successful reviews. It then fades while a
review is overdue — so the roadmap going green means you'd still know it next month, not that you
clicked the right box once.

## Project layout

```
seed-data/content/*.json   One file per track: track, modules, and their questions
src/app/                   Pages (App Router) and API routes
src/components/drill/      The drill runner and one view per question format
src/lib/
  content.ts               Read-side queries over the question bank
  session.ts               Builds the queue for each session mode
  grading.ts               Grades every format; derives the FSRS rating
  executor.ts              Talks to the sandbox worker
  progress.ts              Mastery, streaks, weak spots, dashboard
  fsrs.ts                  Scheduling and the mastery curve
  db/                      Schema, DDL, seed and content validation
public/sandbox.js          The code sandbox (a worker, so a runaway loop can be killed)
scripts/                   Content and grader verification
```

## Adding questions

Content lives in `seed-data/content/<track>.json`. Add an item to a module's `items` array and
re-seed:

```jsonc
{
  "type": "mcq",
  "difficulty": 2,          // 1 foundation, 2 working, 3 professional
  "frequency": 3,           // 1 niche, 2 common, 3 asked constantly
  "tags": ["closures"],     // these drive the weak-spot detection
  "prompt": "What does this log?",
  "code": "…",
  "language": "js",
  "choices": ["…", "…"],
  "answer": 1,              // shape depends on the type — see below
  "explanation": "Why, in enough depth to actually teach it.",
  "followUp": "What the interviewer asks next.",
  "estSeconds": 45
}
```

The `answer` field by type: `mcq` a choice index; `multi` an array of indices; `predict` the
expected output string; `fill` an array of blank values (each may offer alternatives as
`"await|Promise.all"`), one per `___` run in the code; `order` the choice indices in the correct
sequence. `explain` items need `keywords` and a `modelAnswer` instead; `code` items need
`starterCode`, `solutionCode` and `testCases`.

A code test case is either `{"input": [...], "expected": …}` or, when the exercise returns
something you have to drive — a factory, a wrapper — `{"call": "const c = fn(0); return c.value();",
"expected": 0}`.

Item ids are derived from the track slug, module slug and position, so editing an explanation or
appending a question leaves everyone's review schedule intact. **Reordering or removing items
changes ids**, and removed items take their review history with them.

```bash
npm run db:seed          # upsert content (safe to re-run)
npm run db:reset         # delete the database and start over
```

## Checks

```bash
npm run check            # typecheck + lint + content validation
npm run check:gradable   # feeds every item its own answer and asserts the grader agrees
npm run check:code       # runs each code item's solution against its tests
```

`check:gradable` is the one that matters when authoring: it catches an answer index pointing past
the end of the choices, a `fill` whose expected value can't actually be typed, or a `predict` the
normaliser would reject.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, SQLite via `better-sqlite3`,
Drizzle for the schema definition, CodeMirror 6 for the editor, `ts-fsrs` for scheduling.
