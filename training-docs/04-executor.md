# Training Doc: Code Executor (`src/lib/executor.ts`)

## Purpose
This file is the **client-side code execution engine**. When a user clicks "Run Tests," their JavaScript code is executed right in the browser against a set of test cases. It also **classifies errors** into 7 categories (syntax, runtime, timeout, edge-case, type-mismatch, off-by-one, logic) which helps the FSRS algorithm and analytics understand where users struggle. This is one of the most technically interesting files in the codebase.

## Prerequisites
- JavaScript's `Function` constructor and how it differs from `eval()`
- Understanding of `try/catch` error handling
- The `TestCase` and `ExecutionResult` types from `types/index.ts`
- The `deepEqual` utility from `utils.ts`

---

## Line-by-Line Walkthrough of Key Code

### Lines 4–7 — Extracting the Function Name
```typescript
function extractFunctionName(code: string): string | null {
  const match = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
  return match ? match[1] : null;
}
```
**Why this matters:** Before we can execute the user's code, we need to know the name of their function so we can call it. This regex:
- `function\s+` — matches the `function` keyword followed by whitespace
- `([a-zA-Z_$][a-zA-Z0-9_$]*)` — captures the function name (must start with a letter, underscore, or `$`, followed by any alphanumeric characters)
- `\s*\(` — matches optional whitespace before the opening parenthesis

The **capture group** `()` around the name lets us extract it with `match[1]`. If the user writes `function reverseString(str)`, this returns `"reverseString"`.

**Limitation:** This only works for standard function declarations. It would NOT match arrow functions (`const fn = (x) => x`), class methods, or function expressions assigned to variables.

---

### Lines 9–24 — Entry Point and Guard Check
```typescript
export function executeUserCode(
  userCode: string,
  testCases: TestCase[]
): ExecutionResult {
  const fnName = extractFunctionName(userCode);
  if (!fnName) {
    return {
      allPassed: false,
      results: testCases.map((tc) => ({
        passed: false,
        error: "Could not find a function declaration in your code.",
        testCase: tc,
      })),
      errorType: "syntax-error",
    };
  }
```
**Why this matters:** If we can't find a function name, there's no point executing anything. Instead of crashing, we return a clean error result for every test case. Notice how the early return follows the **guard clause pattern** — handle the error case first, then proceed with the happy path.

---

### Lines 26–59 — Running Each Test Case (THE CORE EXECUTION LOGIC)
```typescript
const results: TestResult[] = testCases.map((tc) => {
  try {
    const fn = new Function(
      `${userCode};\nreturn ${fnName}(...arguments);`
    );

    const startTime = performance.now();
    const result = fn(...tc.input);
    const elapsed = performance.now() - startTime;

    if (elapsed > 5000) {
      return { passed: false, error: "Timeout (>5s)", testCase: tc };
    }

    const passed = deepEqual(result, tc.expected) ||
      (tc.expected === null && result === undefined) ||
      (tc.expected === undefined && result === null);

    return {
      passed,
      result,
      expected: tc.expected,
      testCase: tc,
    };
  } catch (e) {
    return {
      passed: false,
      error: e instanceof Error ? e.message : String(e),
      testCase: tc,
    };
  }
});
```
**Why this matters:** This is the heart of the code execution system. Let's break down each piece:

**`new Function()` — The execution mechanism (line 29-31):**
```typescript
const fn = new Function(
  `${userCode};\nreturn ${fnName}(...arguments);`
);
```
The `Function` constructor creates a new function from a string of code. If the user wrote:
```javascript
function reverseString(str) {
  return str.split("").reverse().join("");
}
```
Then the generated function body becomes:
```javascript
function reverseString(str) {
  return str.split("").reverse().join("");
}
return reverseString(...arguments);
```
The `...arguments` spread passes whatever arguments we call `fn()` with directly to the user's function. This is safer than `eval()` because:
1. The code runs in its own scope (can't access local variables)
2. The function can be called multiple times with different inputs

**Timing check (lines 33-38):**
```typescript
const startTime = performance.now();
const result = fn(...tc.input);
const elapsed = performance.now() - startTime;
if (elapsed > 5000) {
  return { passed: false, error: "Timeout (>5s)", testCase: tc };
}
```
`performance.now()` is used instead of `Date.now()` because it provides sub-millisecond precision. The 5-second timeout prevents infinite loops from freezing the browser. Note: this is a **post-execution check**, not a true timeout — if the code takes 30 seconds, the browser will be frozen for 30 seconds before this check runs. A true timeout would require Web Workers (a future improvement).

**Result comparison (lines 42-44):**
```typescript
const passed = deepEqual(result, tc.expected) ||
  (tc.expected === null && result === undefined) ||
  (tc.expected === undefined && result === null);
```
We use `deepEqual` (from utils.ts) for comparing complex objects/arrays. The extra null/undefined checks handle a common JavaScript gotcha: a function that doesn't explicitly return anything returns `undefined`, but the test case might expect `null`. Treating them as equivalent improves the user experience.

**Error handling (lines 52-57):**
```typescript
catch (e) {
  return {
    passed: false,
    error: e instanceof Error ? e.message : String(e),
    testCase: tc,
  };
}
```
If the user's code throws (syntax error, reference error, etc.), we catch it and extract the error message. The `e instanceof Error` check is a TypeScript best practice because `catch` can receive any type.

---

### Lines 68–121 — Error Classification (THE DIAGNOSTIC ENGINE)
```typescript
function classifyError(results: TestResult[]): string | null {
  if (results.every((r) => r.passed)) return null;
  const failures = results.filter((r) => !r.passed);
```
**Why this matters:** This function analyzes the pattern of failures to determine WHAT TYPE of mistake the user made. This powers analytics and helps the system understand user weaknesses. The classifications are checked in priority order:

**Runtime/Syntax Error (lines 74-76):**
```typescript
if (failures.some((r) => r.error && r.error !== "Timeout (>5s)")) {
  return "runtime-error";
}
```
If any test threw an exception (not a timeout), it's a runtime error. This catches things like `ReferenceError`, `TypeError`, `SyntaxError`.

**Timeout (lines 79-81):**
```typescript
if (failures.some((r) => r.error === "Timeout (>5s)")) {
  return "timeout";
}
```
If any test exceeded 5 seconds, the algorithm is likely O(n!) or has an infinite loop.

**Edge Case Miss (lines 84-89):**
```typescript
if (
  failures.length <= 2 &&
  failures.every((r) => r.testCase.isEdgeCase)
) {
  return "edge-case-miss";
}
```
This is clever: if the user passed most tests but failed specifically on tests marked `isEdgeCase`, they likely have a working solution that doesn't handle boundary conditions (empty arrays, single elements, etc.). The `<= 2` threshold means "up to 2 edge case failures."

**Type Mismatch (lines 92-101):**
```typescript
if (
  failures.some(
    (r) =>
      r.result !== undefined &&
      r.expected !== undefined &&
      typeof r.result !== typeof r.expected
  )
) {
  return "type-mismatch";
}
```
If the user returned a number when a string was expected (or vice versa), it's a type problem. `typeof` comparison catches this.

**Off-by-One (lines 104-113):**
```typescript
if (
  failures.some(
    (r) =>
      typeof r.result === "number" &&
      typeof r.expected === "number" &&
      Math.abs(r.result - r.expected) === 1
  )
) {
  return "off-by-one";
}
```
One of the most common programming bugs! If the user's numeric answer differs from expected by exactly 1, it's likely an off-by-one error (e.g., `<` vs `<=`, starting at 0 vs 1).

**Total Logic Failure vs Partial (lines 116-120):**
```typescript
if (failures.length === results.length) {
  return "logic-error";
}
return "partial-failure";
```
If EVERY test failed, the fundamental logic is wrong. If some passed and some failed (and none of the above categories matched), it's a partial failure.

---

## How This File Connects to the Rest of the App
- **Called by** the drill page (`app/app/page.tsx`) when the user clicks "Run Tests"
- **Uses** `deepEqual` from `utils.ts` for comparing complex results
- **Returns** `ExecutionResult` which is displayed by `TestResults` component and sent to the attempts API
- **The `errorType`** is sent to `POST /api/attempts` and stored in the database for analytics

## Key Takeaways
1. `new Function()` is used for client-side code execution (safer than `eval`)
2. Each test case runs independently in a try/catch
3. The timeout check is post-execution, not a true interrupt
4. Error classification uses a priority waterfall (runtime → timeout → edge-case → type-mismatch → off-by-one → logic)
5. `deepEqual` + null/undefined equivalence handles JavaScript's comparison quirks
