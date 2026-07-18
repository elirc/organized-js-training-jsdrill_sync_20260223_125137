# `src/app/app/page.tsx` — The Core Drill Page

**What this file does:** This is the main practice page — the screen where users actually solve problems. It manages the entire drill flow: loading a session, showing the approach prompt, presenting the code editor, running tests, submitting results, and moving to the next problem.

**Why it matters:** This is the most complex React component in the app. It's a **state machine** driven by the `DrillPhase` type, coordinating 10+ pieces of state across multiple child components. Understanding how it orchestrates the drill flow is key to debugging or extending the practice experience.

---

## The State Machine

The drill page is organized as a state machine with 5 phases:

```
approach → coding → running → results → post-solve → (next problem or session complete)
```

The `phase` state variable drives what gets rendered:

```ts
const [phase, setPhase] = useState<DrillPhase>("approach");
```

| Phase | What's on screen | What the user does |
|---|---|---|
| `approach` | Problem description + approach textarea | Describes their plan (min 10 chars) |
| `coding` | Code editor + Run Tests button | Writes code, runs tests |
| `results` | Code editor + test results + Submit button | Reviews results, decides to submit |
| `post-solve` | Result banner, patterns, hints | Reflects on performance |

The `running` phase exists in the type but isn't explicitly used in V1 — test execution is synchronous (via `new Function()`), so there's no visible "loading" state.

---

## The 10 Pieces of State

```ts
const [problems, setProblems] = useState<SessionProblem[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [phase, setPhase] = useState<DrillPhase>("approach");
const [approachText, setApproachText] = useState("");
const [code, setCode] = useState("");
const [results, setResults] = useState<ExecutionResult | null>(null);
const [loading, setLoading] = useState(true);
const [sessionComplete, setSessionComplete] = useState(false);
const [timeElapsed, setTimeElapsed] = useState(0);
const [problemStartTime, setProblemStartTime] = useState(0);
```

Why so many? Each represents a distinct concept:
- **Session state**: `problems`, `currentIndex`, `sessionComplete`, `loading`
- **Problem state**: `phase`, `approachText`, `code`, `results`
- **Timer state**: `timeElapsed`, `problemStartTime`

The current problem is derived, not stored separately:
```ts
const currentProblem = problems[currentIndex];
```

This avoids a synchronization bug — if `currentProblem` were its own state, you'd need to keep it in sync with `currentIndex`.

---

## Session Loading

```ts
const startSession = useCallback(async () => {
  setLoading(true);
  const res = await fetch("/api/session?size=10");
  const json = await res.json();
  if (json.success && json.data.length > 0) {
    setProblems(json.data);
    setCode(json.data[0].starterCode);
    setProblemStartTime(Date.now());
    // ... reset all other state
  }
  setLoading(false);
}, []);

useEffect(() => {
  startSession();
}, [startSession]);
```

`useCallback` with an empty dependency array means `startSession` is created once and never changes. The `useEffect` calls it on mount. This is the standard pattern for "fetch data when the component first renders."

Notice `setCode(json.data[0].starterCode)` — the code editor is initialized with the first problem's starter code immediately. Without this, there'd be a flash of empty editor.

---

## The Timer

```ts
useEffect(() => {
  if (phase === "coding" || phase === "approach") {
    timerRef.current = setInterval(() => {
      setTimeElapsed((t) => t + 1);
    }, 1000);
  }
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [phase]);
```

The timer runs during the `approach` and `coding` phases — the two phases where the user is actively working. It pauses during `results` and `post-solve`.

**The `useRef` for the interval ID:** `timerRef` holds the interval ID across renders. We need this because `clearInterval` requires the exact ID returned by `setInterval`. A regular variable would lose the ID after each render.

**The cleanup function:** `return () => { clearInterval(...) }` runs before the effect re-fires (when `phase` changes) and on unmount. This prevents interval leaks — without cleanup, each phase change would create a *new* interval without stopping the old one, causing the timer to accelerate.

**The updater function:** `setTimeElapsed((t) => t + 1)` uses the function form of `setState`. This avoids a stale closure — if we wrote `setTimeElapsed(timeElapsed + 1)`, the `timeElapsed` captured in the closure would always be the value from when the interval was created.

---

## Running Tests

```ts
const handleRunTests = () => {
  if (!currentProblem) return;
  const executionResults = executeUserCode(code, currentProblem.testCases);
  setResults(executionResults);
  setPhase("results");
};
```

Notably simple. The heavy lifting is in `executor.ts`. We pass the user's current code and the problem's test cases, get back structured results, and transition to the `results` phase. The Run Tests button stays available (phase doesn't change from `coding` to prevent it), so users can run tests multiple times before submitting.

---

## Submitting an Attempt

```ts
const handleSubmit = async () => {
  const timeSpent = Math.floor((Date.now() - problemStartTime) / 1000);

  await fetch("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      problemId: currentProblem.id,
      code,
      approachText,
      passed: results.allPassed,
      timeSpent,
      timedMode: false,
      errorType: results.errorType,
    }),
  });

  if (timerRef.current) clearInterval(timerRef.current);
  setPhase("post-solve");
};
```

`timeSpent` is calculated from `problemStartTime` (set when the problem was loaded). This gives total wall-clock time including both approach writing and coding.

The timer is explicitly stopped here because the `useEffect` cleanup only runs when `phase` changes — but `setPhase("post-solve")` hasn't triggered a re-render yet when `clearInterval` is called. Stopping it explicitly avoids a potential off-by-one second.

`timedMode: false` is hardcoded for V1. When timed mode is added, this would come from a toggle.

---

## Moving to the Next Problem

```ts
const handleNext = () => {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= problems.length) {
    setSessionComplete(true);
    return;
  }

  setCurrentIndex(nextIndex);
  setPhase("approach");
  setCode(problems[nextIndex].starterCode);
  setResults(null);
  setTimeElapsed(0);
  setProblemStartTime(Date.now());
};
```

Every piece of per-problem state gets reset: phase goes back to `approach`, code resets to the new problem's starter code, results are cleared, timer resets. The approach text is also cleared (set via `setApproachText("")` earlier).

If we're past the last problem, we flip `sessionComplete` and the component renders the completion screen instead.

---

## Conditional Rendering Pattern

The return statement uses conditional rendering based on state:

```tsx
if (loading) return <Spinner />;
if (problems.length === 0) return <EmptyState />;
if (sessionComplete) return <CompletionScreen />;

return (
  <div>
    <SessionProgress ... />
    <ProblemCard ... />
    {phase === "approach" && <ApproachPrompt ... />}
    {(phase === "coding" || phase === "results") && <CodeEditor ... />}
    {phase === "post-solve" && <PostSolve ... />}
  </div>
);
```

The early returns handle edge cases (loading, empty, complete). The main render uses `&&` conditionals to show/hide sections based on the current phase. This is React's standard pattern for phase-based UIs.

Notice the coding editor stays visible during `results` phase — `(phase === "coding" || phase === "results")`. This lets users see their code alongside the test results, which is essential for debugging failures.

---

## The Progress Bar Calculation

```tsx
<SessionProgress
  current={currentIndex + (phase === "post-solve" ? 1 : 0)}
  total={problems.length}
  timeElapsed={timeElapsed}
/>
```

The `+ (phase === "post-solve" ? 1 : 0)` is a UX touch: during post-solve, the progress bar shows the problem as "completed" (advanced by 1), even though `currentIndex` hasn't incremented yet. Without this, the progress bar wouldn't move until you click "Next Problem."
