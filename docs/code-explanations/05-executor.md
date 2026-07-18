# `src/lib/executor.ts` — Client-Side Code Execution Engine

**What this file does:** Takes user-written JavaScript code and a set of test cases, executes the code against each test case, and returns structured pass/fail results with error classification.

**Why it matters:** This is the engine that makes the "run tests" button work. It runs entirely in the browser — no server involved. Understanding it is essential for debugging test execution issues or adding new features like multi-language support.

---

## The Big Picture

```
User's code string → extractFunctionName() → new Function() → execute per test case → deepEqual comparison → classifyError() → ExecutionResult
```

## Step 1: Extract the Function Name

```ts
function extractFunctionName(code: string): string | null {
  const match = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
  return match ? match[1] : null;
}
```

The regex looks for `function someName(` and captures `someName`. This is how we know what to call. The character class `[a-zA-Z_$][a-zA-Z0-9_$]*` matches valid JavaScript identifiers.

**Limitation:** This only finds `function` declarations, not arrow functions (`const fn = () => ...`) or `class` methods. That's intentional — the starter code always uses `function` declarations, so we enforce a consistent style.

If the regex doesn't match (the user deleted the function declaration or wrote something unexpected), we immediately return all tests as failed with a clear error message.

## Step 2: Create a Sandboxed Function

```ts
const fn = new Function(
  `${userCode};\nreturn ${fnName}(...arguments);`
);
```

`new Function()` creates a function from a string. It's similar to `eval()` but with an important difference: the created function runs in a **separate scope**. It can't access variables in the surrounding code (like `db`, `schema`, or other imports). It can only access global builtins (`Math`, `Array`, `Object`, etc.) and its own `arguments`.

The generated code looks like:
```js
function twoSum(nums, target) {
  // user's code
};
return twoSum(...arguments);
```

The `...arguments` spread passes whatever arguments we give the outer function through to the user's function. When we call `fn(...tc.input)`, the test case inputs become the function arguments.

## Step 3: Execute and Compare

```ts
const startTime = performance.now();
const result = fn(...tc.input);
const elapsed = performance.now() - startTime;
```

We time each execution. If it takes over 5 seconds, we consider it a timeout (probably an infinite loop). We use `performance.now()` instead of `Date.now()` because it's more precise (sub-millisecond resolution).

The comparison uses our custom `deepEqual`:
```ts
const passed = deepEqual(result, tc.expected) ||
  (tc.expected === null && result === undefined) ||
  (tc.expected === undefined && result === null);
```

The null/undefined equivalence is a UX choice: when a test case expects `null` and the function returns `undefined` (or vice versa), we treat it as a match. This avoids frustrating users with pedantic null vs. undefined failures in cases where the distinction doesn't matter.

## Step 4: Classify Errors

The `classifyError()` function analyzes failure patterns to give the user actionable feedback:

| Classification | How It's Detected | What It Means |
|---|---|---|
| `runtime-error` | A test case threw an exception | Syntax error, TypeError, ReferenceError, etc. |
| `timeout` | Execution took >5s | Likely an infinite loop |
| `edge-case-miss` | Failed ≤2 tests, all marked as edge cases | Logic works but missed empty/single/boundary inputs |
| `type-mismatch` | Got a different type than expected | Returned a string when number expected, etc. |
| `off-by-one` | Numeric result is exactly 1 away from expected | Classic fencepost error |
| `logic-error` | All tests failed | Fundamental algorithm issue |
| `partial-failure` | Some tests passed, some failed (none of the above) | Partially correct logic |

The order matters — it checks from most specific to least specific. `runtime-error` is checked first because if any test threw, that's the most important thing to surface. `logic-error` is near the end because "all tests failed" is the least informative classification.

---

## Security Considerations

`new Function()` runs user code in the browser's JavaScript engine. Is this safe?

**Yes, for our use case.** The user is running their own code in their own browser. It's no more dangerous than them opening the browser console and typing the same code. The function can't:
- Access our React state or component tree
- Make API calls on the user's behalf (it has no access to `fetch` in scope — though it could use global `fetch`)
- Access the filesystem or Node.js APIs (it's browser JavaScript)

**For a multi-user hosted app**, you'd want server-side sandboxing (Docker containers, Piston API) to prevent one user's code from affecting others. But for V1 where the user runs their own code locally, client-side execution is the right tradeoff.
