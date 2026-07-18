# `src/types/index.ts` — Shared Type Definitions

**What this file does:** Defines TypeScript types that are shared across the client (components), server (API routes), and libraries. This is the "contract" between all layers of the app.

**Why it matters:** When a component expects a `SessionProblem` and an API returns a `SessionProblem`, they both reference this file. Change the type here, and TypeScript will flag every place in the codebase that needs updating.

---

## The Types, Grouped by Purpose

### Test Execution Types (`TestCase`, `TestResult`, `ExecutionResult`)

```ts
export type TestCase = {
  input: unknown[];    // Arguments passed to the user's function
  expected: unknown;   // What the function should return
  description: string; // Human-readable name like "handles empty array"
  isEdgeCase: boolean; // Used by error classifier to detect "edge-case-miss"
};
```

`input` is `unknown[]` (an array of unknowns) because function arguments can be any type — numbers, strings, arrays, objects. Same for `expected`. We use `unknown` instead of `any` because `unknown` forces you to check the type before using the value, which is safer.

`ExecutionResult` wraps the full output of running all test cases:
```ts
export type ExecutionResult = {
  allPassed: boolean;       // Quick check — did everything pass?
  results: TestResult[];    // Per-test-case results
  errorType: string | null; // Classified error or null if all passed
};
```

### Session Types (`SessionProblem`, `DrillPhase`)

`SessionProblem` is what the API returns to the client. It's a denormalized view — the database stores `categoryId` (a foreign key), but the API enriches it with `categoryName` so the client doesn't need a separate fetch. Same for `patterns` — the join table is resolved server-side.

```ts
export type DrillPhase =
  | "approach"    // Writing the approach text
  | "coding"      // Writing code
  | "running"     // Tests are executing (brief)
  | "results"     // Seeing test results
  | "post-solve"; // Seeing patterns, feedback
```

This union type is a **state machine**. The drill page component uses it to decide what to render. TypeScript ensures you can never set `phase` to an invalid value like `"done"`.

### Dashboard Types

These types mirror what the dashboard API returns. `PatternStrength` has a `strength` field that's a union: `"none" | "weak" | "learning" | "strong"`. The server calculates this from FSRS stability averages. The client just renders it — it doesn't need to know the thresholds.

---

## Why `unknown` Instead of `any`

You'll see `unknown` a lot in the test-related types. The difference:
- `any` — TypeScript gives up. You can do `value.foo.bar()` without error.
- `unknown` — TypeScript says "I don't know what this is, check before using it."

Since test case inputs/outputs can be literally anything (numbers, strings, arrays, nested objects), `unknown` is the correct choice. It tells you: "this could be anything, handle it carefully."

---

## The `ApiResponse<T>` Generic

```ts
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

This is a generic type. `T` is a placeholder for whatever data the specific endpoint returns. `ApiResponse<SessionProblem[]>` means the `data` field is an array of `SessionProblem`. The `= unknown` default means if you don't specify `T`, data is `unknown`.

Every API route returns this shape: `{ success: true, data: ... }` on success, `{ success: false, error: "..." }` on failure. This consistency makes client-side error handling predictable.
