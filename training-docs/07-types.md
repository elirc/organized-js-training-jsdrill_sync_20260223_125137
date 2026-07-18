# Training Doc: Type Definitions (`src/types/index.ts`)

## Purpose
This file is the **shared vocabulary** of the entire application. It defines TypeScript types that are used across the frontend, backend, and business logic. Understanding these types is essential because they define the "shape" of data as it flows through the system — from API responses to component props to function parameters.

## Prerequisites
- Basic TypeScript type syntax (`type`, union types `|`, object types)
- Understanding that types are erased at runtime — they only exist for developer tooling and compile-time checks

---

## Line-by-Line Walkthrough of Key Code

### Lines 2–7 — `TestCase` Type
```typescript
export type TestCase = {
  input: unknown[];
  expected: unknown;
  description: string;
  isEdgeCase: boolean;
};
```
**Why this matters:** Every coding problem has test cases, and this defines their shape:

- **`input: unknown[]`** — An array of arguments to pass to the user's function. `unknown[]` means it's an array but we don't know what types are inside (could be numbers, strings, arrays, objects). We use `unknown` instead of `any` because `unknown` is type-safe — you must check the type before using it.
- **`expected: unknown`** — The correct answer. Also `unknown` because different problems have different return types.
- **`isEdgeCase: boolean`** — This flag is used by the error classifier in `executor.ts`. If a user fails only on edge case tests, the error is classified as `"edge-case-miss"` rather than a logic error.

---

### Lines 10–22 — Execution Result Types
```typescript
export type TestResult = {
  passed: boolean;
  result?: unknown;
  expected?: unknown;
  error?: string;
  testCase: TestCase;
};

export type ExecutionResult = {
  allPassed: boolean;
  results: TestResult[];
  errorType: string | null;
};
```
**Why this matters:** These types represent the output of running user code against test cases:

- **`TestResult`** — One per test case. The `?` makes fields optional because:
  - `result` is undefined if the code threw an error (we have `error` instead)
  - `expected` is stored for display in the results UI
  - `error` is only present when the test failed with an exception
  - `testCase` is always present — it's a reference back to the original test case for display

- **`ExecutionResult`** — The aggregate result:
  - `allPassed` is a convenience boolean (equivalent to `results.every(r => r.passed)`)
  - `errorType` is the classified error from `executor.ts` (e.g., `"off-by-one"`, `"edge-case-miss"`, or `null` if all passed)

---

### Lines 28–41 — `SessionProblem` Type (CENTRAL DATA TRANSFER OBJECT)
```typescript
export type SessionProblem = {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCases: TestCase[];
  tier: number;
  categoryId: string;
  categoryName: string;
  hints: string[];
  timeLimit: number;
  patterns: { id: string; name: string; slug: string }[];
  isReview: boolean;
};
```
**Why this matters:** This is the **most important type in the app** — it's what flows from the session builder to the drill page. It's an "enriched" version of the database `problems` row with additional computed fields:

- **`testCases: TestCase[]`** — Already parsed from JSON string to actual objects.
- **`categoryName: string`** — Resolved from the category table (the database only stores `categoryId`).
- **`patterns: { id, name, slug }[]`** — Resolved from the junction table. The frontend needs pattern names for the post-solve reveal.
- **`isReview: boolean`** — Whether this problem is a spaced repetition review (`true`) or a new problem (`false`). The UI uses this to show a "Review" badge.

Notice this type is NOT a direct mirror of the database schema — it's a **Data Transfer Object (DTO)** specifically shaped for the frontend's needs.

---

### Lines 50–55 — `DrillPhase` Union Type
```typescript
export type DrillPhase =
  | "approach"
  | "coding"
  | "running"
  | "results"
  | "post-solve";
```
**Why this matters:** This is a **string literal union type** — the variable can only be one of these exact strings. This defines the state machine used by the drill page:

1. `"approach"` — User explains their approach before coding
2. `"coding"` — User writes code in the editor
3. `"running"` — Tests are executing (currently unused as execution is synchronous)
4. `"results"` — Test results are displayed
5. `"post-solve"` — Pattern reveal, feedback, and "Next" button

The benefit of a union type over plain `string` is **exhaustiveness checking**. If you write a `switch` on a `DrillPhase` and forget to handle `"post-solve"`, TypeScript will warn you.

---

### Lines 58–62 — `ApiResponse` Generic Type
```typescript
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};
```
**Why this matters:** This defines the standard shape for ALL API responses in the app. The `<T = unknown>` is a **generic type parameter** with a default:

- `ApiResponse<SessionProblem[]>` → `{ success: boolean, data?: SessionProblem[], error?: string }`
- `ApiResponse` (no parameter) → `{ success: boolean, data?: unknown, error?: string }`

The convention is: if `success` is `true`, `data` is present; if `false`, `error` is present. Every API route follows this pattern.

---

### Lines 65–83 — Dashboard Types
```typescript
export type CategoryProgress = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  currentTier: number;
  totalProblems: number;
  solvedProblems: number;
  averageStability: number;
};

export type PatternStrength = {
  patternId: string;
  patternName: string;
  patternSlug: string;
  totalProblems: number;
  solvedProblems: number;
  averageStability: number;
  strength: "none" | "weak" | "learning" | "strong";
};
```
**Why this matters:** These types define the shape of dashboard analytics data:

- **`CategoryProgress`** — Aggregated stats per category. `averageStability` is a mean of all the user's FSRS stability values for problems in this category.
- **`PatternStrength`** — Per-pattern analytics. The `strength` field is a computed classification:
  - `"none"` — Haven't attempted any problems with this pattern
  - `"weak"` — Average stability < 3 (forgetting quickly)
  - `"learning"` — Average stability 3–10 (building familiarity)
  - `"strong"` — Average stability > 10 (well-remembered)

---

### Lines 85–88 — `DayActivity`
```typescript
export type DayActivity = {
  date: string;
  count: number;
};
```
**Why this matters:** Used by the heat map visualization on the dashboard. Each entry represents one day and how many attempts the user made that day.

---

## How This File Connects to the Rest of the App
- **Imported everywhere** — this is the most-imported file in the project
- **`SessionProblem`** flows from `sessionBuilder.ts` → session API → drill page → drill components
- **`ExecutionResult`/`TestResult`** flow from `executor.ts` → drill page → `TestResults` component → attempts API
- **`DrillPhase`** controls the UI state machine in the drill page
- **`CategoryProgress`/`PatternStrength`/`DayActivity`** flow from dashboard API → dashboard page → visualization components
- **`ApiResponse`** standardizes all API communication

## Key Takeaways
1. Types are the shared contract between frontend and backend
2. `SessionProblem` is NOT a direct database mirror — it's enriched for frontend use
3. `DrillPhase` union type implements a type-safe state machine
4. `unknown` is preferred over `any` for type safety
5. Generic types like `ApiResponse<T>` enable reusable, type-safe patterns
