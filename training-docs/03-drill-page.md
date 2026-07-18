# Training Doc: Main Drill Page (`src/app/app/page.tsx`)

## Purpose
This is the **primary user-facing page** of the entire application — where users actually practice coding. It manages a complex multi-phase state machine that guides users through: explaining their approach → writing code → running tests → reviewing results → seeing patterns revealed. Understanding this file is essential because it orchestrates all the drill UI components and ties them to the backend APIs.

## Prerequisites
- React hooks (`useState`, `useEffect`, `useCallback`, `useRef`)
- Understanding of the session builder (see `02-session-builder.md`)
- Familiarity with Next.js App Router ("use client" directive)
- Understanding of the `DrillPhase` type from `types/index.ts`

---

## Line-by-Line Walkthrough of Key Code

### Line 1 — Client Component Directive
```typescript
"use client";
```
**Why this matters:** In Next.js App Router, components are server components by default. Adding `"use client"` makes this a **client component** that runs in the browser. This is required because we use React hooks (`useState`, `useEffect`), browser APIs (`Date.now()`, `setInterval`), and event handlers — none of which work on the server.

---

### Lines 16–26 — State Declarations (THE STATE MACHINE)
```typescript
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
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```
**Why this matters:** These state variables form the **complete state of the drill experience**. Understanding each one:

- **`problems`** — The array of `SessionProblem` objects returned from the session API. This is the "deck" of problems for this session.
- **`currentIndex`** — Which problem in the array we're currently on (0-indexed).
- **`phase`** — The current stage of the drill flow. This is the state machine's current state. Valid values: `"approach"`, `"coding"`, `"running"`, `"results"`, `"post-solve"`.
- **`approachText`** — What the user typed to explain their approach before coding.
- **`code`** — The current code in the editor.
- **`results`** — The test execution results (null until tests are run).
- **`timerRef`** — A `useRef` to store the interval ID. We use `useRef` instead of `useState` because changing a ref doesn't cause a re-render, and we need to access it in cleanup functions.

**The state machine flow:**
```
approach → coding → results → post-solve → (next problem or session complete)
```

---

### Lines 30–50 — `startSession` (Loading the Problem Queue)
```typescript
const startSession = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch("/api/session?size=10");
    const json = await res.json();
    if (json.success && json.data.length > 0) {
      setProblems(json.data);
      setCurrentIndex(0);
      setPhase("approach");
      setApproachText("");
      setCode(json.data[0].starterCode);
      setResults(null);
      setSessionComplete(false);
      setTimeElapsed(0);
      setProblemStartTime(Date.now());
    }
  } catch (err) {
    console.error("Failed to load session:", err);
  }
  setLoading(false);
}, []);
```
**Why this matters:** This function fetches a new session from the backend and resets ALL state to initial values. Key details:

- **`useCallback(fn, [])`** — Memoizes the function so it has a stable reference. The empty dependency array `[]` means it's created once and never re-created. This is important because `startSession` is used in a `useEffect` dependency array.
- **`fetch("/api/session?size=10")`** — Calls the session API which triggers `buildSession(10)` on the server.
- **`setCode(json.data[0].starterCode)`** — Pre-populates the code editor with the first problem's starter code.
- **`setProblemStartTime(Date.now())`** — Captures when the user started this problem, used later to calculate `timeSpent`.
- **All the `set*` calls** — Every piece of state is reset. This is critical for when the user starts a new session after completing one.

---

### Lines 57–66 — Timer Effect
```typescript
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
**Why this matters:** This effect manages the elapsed time counter. Important patterns:

- **Conditional interval** — The timer only ticks during "approach" and "coding" phases. Once the user submits or views results, the clock stops.
- **`setTimeElapsed((t) => t + 1)`** — Uses the functional updater form (receives previous value `t`). This avoids stale closure issues — without it, the callback would capture the `timeElapsed` value from when the interval was created.
- **Cleanup return function** — `return () => { clearInterval(timerRef.current) }` runs when the phase changes or the component unmounts. This prevents memory leaks from orphaned intervals. This is a critical React pattern — always clean up side effects.

---

### Lines 73–78 — `handleRunTests` (Code Execution)
```typescript
const handleRunTests = () => {
  if (!currentProblem) return;
  const executionResults = executeUserCode(code, currentProblem.testCases);
  setResults(executionResults);
  setPhase("results");
};
```
**Why this matters:** This triggers **client-side code execution**. The user's code runs directly in the browser via `executeUserCode()` (see `04-executor.md`). After execution, we store the results and transition to the "results" phase. Note: no API call here — test execution is entirely client-side for instant feedback.

---

### Lines 80–106 — `handleSubmit` (Recording the Attempt)
```typescript
const handleSubmit = async () => {
  if (!currentProblem || !results) return;
  const timeSpent = Math.floor((Date.now() - problemStartTime) / 1000);

  try {
    await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  } catch (err) {
    console.error("Failed to record attempt:", err);
  }

  if (timerRef.current) clearInterval(timerRef.current);
  setPhase("post-solve");
};
```
**Why this matters:** This is where the drill session connects to the backend and triggers the FSRS update:

- **`timeSpent` calculation** — `Date.now() - problemStartTime` gives milliseconds, divided by 1000 for seconds, `Math.floor` to round down.
- **`POST /api/attempts`** — Sends all attempt data to the server. The server will: (1) record the attempt, (2) update the FSRS card, (3) update tier progress. See `05-attempts-api.md` for details.
- **`results.allPassed`** and **`results.errorType`** — These come from the client-side execution. The server uses `passed` to determine the FSRS rating.
- **Fire-and-forget** — Note that the UI doesn't wait for the API response to proceed. Even if recording fails, the user still moves to post-solve. This is a UX choice: don't block the user experience for a background operation.

---

### Lines 108–122 — `handleNext` (Advancing to Next Problem)
```typescript
const handleNext = () => {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= problems.length) {
    setSessionComplete(true);
    return;
  }

  setCurrentIndex(nextIndex);
  setPhase("approach");
  setApproachText("");
  setCode(problems[nextIndex].starterCode);
  setResults(null);
  setTimeElapsed(0);
  setProblemStartTime(Date.now());
};
```
**Why this matters:** This resets state for the next problem — similar to `startSession` but only for per-problem state. The key check: if `nextIndex >= problems.length`, the session is complete. Otherwise, all problem-specific state is reset and the phase goes back to "approach".

---

### Lines 178–242 — The Render (Phase-Based UI)
```typescript
return (
  <div className="space-y-4">
    <SessionProgress current={...} total={problems.length} timeElapsed={timeElapsed} />
    <Card><ProblemCard problem={currentProblem} /></Card>

    {phase === "approach" && (
      <Card><ApproachPrompt onSubmit={handleApproachSubmit} /></Card>
    )}

    {(phase === "coding" || phase === "results") && (
      <div className="space-y-4">
        <Card padding="none"><CodeEditor initialCode={code} onChange={setCode} /></Card>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleRunTests}>Run Tests</Button>
          {results && <Button onClick={handleSubmit}>Submit</Button>}
        </div>
        {results && <Card><TestResults results={results} /></Card>}
      </div>
    )}

    {phase === "post-solve" && results && (
      <Card><PostSolve problem={currentProblem} results={results} ... /></Card>
    )}
  </div>
);
```
**Why this matters:** The JSX uses **conditional rendering** based on the current `phase` to show/hide different sections:

- **`SessionProgress`** — Always visible. Shows progress bar and timer.
- **`ProblemCard`** — Always visible. Shows the problem title and description.
- **`{phase === "approach" && ...}`** — Only shows the approach prompt in the approach phase.
- **`{(phase === "coding" || phase === "results") && ...}`** — The code editor stays visible during both coding AND results phases so the user can see their code alongside test results.
- **`{results && <Button onClick={handleSubmit}>Submit</Button>}`** — The Submit button only appears after tests have been run (when `results` is not null).
- **`{phase === "post-solve" && ...}`** — Shows pattern reveal and next button.

This pattern of conditional rendering based on a phase variable is essentially a **state machine rendered as UI**.

---

## How This File Connects to the Rest of the App
- **Calls** `GET /api/session` to load problems (which triggers `sessionBuilder.ts`)
- **Calls** `POST /api/attempts` to record results (which triggers FSRS updates)
- **Uses** `executeUserCode()` from `executor.ts` for client-side test execution
- **Renders** `SessionProgress`, `ProblemCard`, `ApproachPrompt`, `CodeEditor`, `TestResults`, `PostSolve` components
- **Consumes** `SessionProblem`, `ExecutionResult`, `DrillPhase` types

## Key Takeaways
1. The drill page is a state machine with 5 phases
2. Session data is fetched once, then all navigation is client-side
3. Code execution happens in the browser (no server round-trip for tests)
4. Attempt recording is fire-and-forget to keep UX smooth
5. The timer only runs during active phases (approach + coding)
