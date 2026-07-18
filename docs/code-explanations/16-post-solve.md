# `src/components/drill/PostSolve.tsx` — Post-Solve Screen

**What this file does:** Renders the reflection screen shown after the user submits their solution. It displays the result (pass/fail), their approach text, the problem's associated patterns, hints (on failure), and a button to proceed.

**Why it matters:** This is where learning reinforcement happens. The approach recap forces users to compare their plan with reality. The pattern reveal builds recognition. The hints on failure provide guided recovery instead of just "wrong, try again."

---

## The Pedagogical Design

This component isn't just displaying data — it's implementing a learning methodology:

1. **Result banner** — Immediate, clear feedback. Green/red, no ambiguity.
2. **Approach recap** — "Here's what you said you'd do." Comparing plan vs execution builds metacognition (awareness of your own thinking process).
3. **Pattern reveal** — "This problem uses the Two Pointer pattern." Even if you solved it, knowing the pattern name helps you recognize it in future problems.
4. **Hints on failure** — Only shown when tests failed. Not generic "try harder" messages, but specific algorithmic hints from the problem author.

---

## Conditional Information Display

```tsx
{/* Approach recap — always shown if approach text exists */}
{approachText && (
  <Card padding="sm">
    <h4>Your Approach</h4>
    <p className="text-sm text-gray-700 italic">&quot;{approachText}&quot;</p>
  </Card>
)}

{/* Patterns — always shown if patterns exist */}
{problem.patterns.length > 0 && (
  <Card padding="sm">
    <h4>Pattern</h4>
    <div className="flex flex-wrap gap-2">
      {problem.patterns.map((p) => (
        <Badge key={p.id} variant="info">{p.name}</Badge>
      ))}
    </div>
  </Card>
)}

{/* Hints — only shown on FAILURE */}
{!results.allPassed && problem.hints.length > 0 && (
  <Card padding="sm">
    <h4>Hints</h4>
    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
      {problem.hints.map((hint, i) => (
        <li key={i}>{hint}</li>
      ))}
    </ul>
  </Card>
)}
```

The `&&` short-circuit pattern is React's conditional rendering. `condition && <Component />` renders the component only when the condition is truthy. It reads as: "if there are patterns, show the pattern card."

Hints are gated behind `!results.allPassed` — if you passed, you don't need hints. This prevents information overload and preserves hints as a "reward" for struggling through failure.

---

## The Result Banner

```tsx
<div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
  results.allPassed
    ? "bg-green-50 border border-green-200"
    : "bg-red-50 border border-red-200"
}`}>
  <div className="flex items-center gap-2">
    <span className="text-xl">{results.allPassed ? "✅" : "❌"}</span>
    <span className={`font-semibold ${results.allPassed ? "text-green-700" : "text-red-700"}`}>
      {results.allPassed ? "All tests passed" : "Some tests failed"}
    </span>
  </div>
  <span className="text-sm text-gray-500 font-mono">{formatTime(timeSpent)}</span>
</div>
```

The time display (`formatTime(timeSpent)`) shows total time in MM:SS format. Showing time reinforces the timed-practice mindset even before timed mode is formally implemented.

---

## The Navigation Button

```tsx
<Button onClick={onNext} size="lg">
  {isLastProblem ? "Finish Session" : "Next Problem →"}
</Button>
```

The label changes based on position in the session. `isLastProblem` is calculated in the parent: `currentIndex === problems.length - 1`. This gives users a clear signal that the session is ending.

---

## Props Design

```ts
type PostSolveProps = {
  problem: SessionProblem;
  results: ExecutionResult;
  approachText: string;
  timeSpent: number;
  onNext: () => void;
  isLastProblem: boolean;
};
```

This component receives everything it needs via props — it doesn't fetch any data or manage complex state. This is intentional. It's a **presentational component** (also called a "dumb component"): it receives data, renders it, and calls callbacks. All the logic lives in the parent (`DrillPage`).

This makes `PostSolve` easy to test, easy to understand, and reusable in other contexts (e.g., a review history view could reuse it to show past results).
