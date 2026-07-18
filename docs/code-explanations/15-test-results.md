# `src/components/drill/TestResults.tsx` — Test Results Display

**What this file does:** Renders the pass/fail results of running the user's code against test cases. Shows a summary banner, per-test status, and for failures, shows the expected vs. actual output diff.

**Why it matters:** Good error presentation is the difference between a user who understands their bug and one who gives up in frustration. This component structures failure information so users can quickly diagnose what went wrong.

---

## The Summary Banner

```tsx
<div className={cn(
  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold",
  results.allPassed
    ? "bg-green-50 text-green-700 border border-green-200"
    : "bg-red-50 text-red-700 border border-red-200"
)}>
  <span>{results.allPassed ? "✅" : "❌"}</span>
  <span>
    {results.allPassed
      ? "All tests passed!"
      : `${results.results.filter((r) => r.passed).length}/${results.results.length} tests passed`}
  </span>
  {results.errorType && !results.allPassed && (
    <span className="ml-auto text-xs opacity-75">
      Type: {results.errorType}
    </span>
  )}
</div>
```

Three pieces of information at a glance:
1. **Color coding** — green = all good, red = something failed. The `cn()` utility conditionally applies the right color scheme.
2. **Pass count** — "3/5 tests passed" tells you how close you are.
3. **Error classification** — the `errorType` from the executor (e.g., "off-by-one", "edge-case-miss") appears as a subtle tag. This gives users a hint about the *category* of their mistake.

---

## Per-Test Detail Cards

```tsx
{results.results.map((r, i) => (
  <div className={cn(
    "flex items-start gap-2 px-3 py-2 rounded-lg text-xs border",
    r.passed
      ? "bg-green-50/50 border-green-100"
      : "bg-red-50/50 border-red-100"
  )}>
    <span className="mt-0.5">{r.passed ? "✓" : "✗"}</span>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-gray-700">{r.testCase.description}</div>
      {!r.passed && (
        // ... show error or expected/got diff
      )}
    </div>
  </div>
))}
```

Each test case gets its own card. Passed tests just show the description with a checkmark. Failed tests show additional diagnostic information.

The `/50` in `bg-green-50/50` is Tailwind's opacity modifier — 50% opacity on the green-50 background. This makes passed tests visually lighter than the summary banner, creating visual hierarchy.

---

## The Failure Diff: Expected vs. Got

```tsx
{r.error ? (
  <div className="text-red-600 font-mono">{r.error}</div>
) : (
  <>
    <div className="text-gray-500">
      Expected: <span className="font-mono text-green-700">{JSON.stringify(r.expected)}</span>
    </div>
    <div className="text-gray-500">
      Got: <span className="font-mono text-red-600">{JSON.stringify(r.result)}</span>
    </div>
  </>
)}
```

Two failure modes:
1. **Runtime error** — the code threw an exception. Show the error message in red monospace.
2. **Wrong answer** — the code returned a value, but it's not what we expected. Show both expected (green) and actual (red) values.

`JSON.stringify` is used to display values because the expected/actual can be any type — arrays, objects, numbers, strings. `JSON.stringify([1,2,3])` gives you `"[1,2,3]"` which is readable. Without it, an array would display as `"1,2,3"` (JavaScript's default `.toString()` for arrays joins with commas and loses the brackets).

---

## The `min-w-0` Trick

```tsx
<div className="flex-1 min-w-0">
```

This is a CSS flexbox gotcha. By default, flex children have `min-width: auto`, which prevents them from shrinking below their content size. If a test case has a very long error message, it would overflow the container. `min-w-0` allows the flex child to shrink, enabling `overflow` or `text-overflow` to work.

---

## Design Decisions

**Why not collapsible test cases?** With 5-8 test cases typical, everything fits on screen. Collapsible sections add interaction cost (click to expand) without saving meaningful space. If a problem had 50 test cases, we'd reconsider.

**Why `JSON.stringify` instead of a pretty printer?** For the data types our test cases use (numbers, strings, simple arrays, shallow objects), `JSON.stringify` is readable enough. A pretty printer would add complexity for marginal benefit at our scale.
