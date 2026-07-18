# `src/components/admin/ProblemForm.tsx` — Admin Problem Form

**What this file does:** Renders a large, multi-section form for creating and editing problems. It fetches categories and patterns on mount, manages test case editing in two modes (form or raw JSON), handles hints as a dynamic list, and submits via POST (create) or PUT (edit).

**Why it matters:** This is the most state-heavy component in the app (15+ pieces of state). It demonstrates real-world form patterns: shared create/edit components, dynamic list management, dual editing modes, and how to handle complex nested data structures in forms.

---

## The Create/Edit Reuse Pattern

```ts
type ProblemFormProps = {
  initialData?: { ... };
  mode: "create" | "edit";
};
```

One component handles both creating new problems and editing existing ones. The `mode` prop controls:
- Whether fields start empty or pre-filled (`initialData?.title || ""`)
- Which HTTP method to use (`POST` vs `PUT`)
- Which URL to hit (`/api/problems` vs `/api/problems/:id`)
- The submit button label (`"Create Problem"` vs `"Save Changes"`)

This prevents code duplication. The alternative — separate `CreateProblemForm` and `EditProblemForm` components — would share 90% of their code.

---

## State Initialization with Defaults

```ts
const [title, setTitle] = useState(initialData?.title || "");
const [starterCode, setStarterCode] = useState(
  initialData?.starterCode || "function solution() {\n  // your code here\n}"
);
const [tier, setTier] = useState(initialData?.tier || 1);
```

Each field gets a sensible default when creating. The `?.` (optional chaining) handles `initialData` being `undefined` in create mode, and `||` provides the fallback.

The starter code default includes a function stub — this matches the executor's requirement that user code must have a `function` declaration.

---

## Fetching Related Data on Mount

```ts
useEffect(() => {
  Promise.all([
    fetch("/api/categories").then((r) => r.json()),
    fetch("/api/patterns").then((r) => r.json()),
  ]).then(([catRes, patRes]) => {
    if (catRes.success) {
      setCategories(catRes.data);
      if (!categoryId && catRes.data.length > 0) {
        setCategoryId(catRes.data[0].id);
      }
    }
    if (patRes.success) setPatterns(patRes.data);
  });
}, []);
```

**`Promise.all`** fetches categories and patterns in parallel — faster than two sequential fetches. The results arrive as a tuple `[catRes, patRes]` that we destructure.

The `if (!categoryId && catRes.data.length > 0)` auto-selects the first category in create mode (when `categoryId` is empty). In edit mode, `categoryId` is already set from `initialData`, so this doesn't trigger.

The `// eslint-disable-line react-hooks/exhaustive-deps` suppresses the warning about `categoryId` not being in the dependency array. Including it would cause an infinite loop (fetch → setCategoryId → re-render → re-fetch).

---

## Dual Test Case Editing Modes

Test cases are complex objects (`{ input: unknown[], expected: unknown, description: string, isEdgeCase: boolean }`). Editing them in form fields is painful because `input` is an arbitrary JSON array. So we offer two modes:

### Form Editor Mode
Each test case renders as a card with individual inputs:
```tsx
<Input
  placeholder='Input args as JSON array, e.g. [[1,2,3]]'
  value={JSON.stringify(tc.input)}
  onChange={(e) => {
    try {
      const parsed = JSON.parse(e.target.value);
      // update state
    } catch {
      // Let them type — invalid JSON while typing is normal
    }
  }}
/>
```

The `try/catch` around `JSON.parse` is crucial. When you type `[1,`, that's invalid JSON. The catch block silently ignores parse errors, letting the user continue typing until the JSON is valid. State only updates on valid JSON.

### JSON Editor Mode
A single textarea with the full test cases array as formatted JSON:
```tsx
<Textarea
  value={testCasesJson}
  onChange={(e) => setTestCasesJson(e.target.value)}
  rows={12}
  className="font-mono text-xs"
/>
```

This is easier for power users who can write JSON directly. The toggle between modes:
```tsx
<Button onClick={() => setUseJsonEditor(!useJsonEditor)}>
  {useJsonEditor ? "Form Editor" : "JSON Editor"}
</Button>
```

---

## Dynamic Hints List

```ts
const [hints, setHints] = useState<string[]>(initialData?.hints || [""]);

const addHint = () => setHints([...hints, ""]);
const removeHint = (i: number) => setHints(hints.filter((_, idx) => idx !== i));
const updateHint = (i: number, val: string) => {
  const updated = [...hints];
  updated[i] = val;
  setHints(updated);
};
```

This is the **dynamic list pattern** in React. Three operations:
- **Add**: Spread existing array + append empty string
- **Remove**: Filter out by index (not value, in case of duplicates)
- **Update**: Copy array, modify at index, set new array

Always creating new arrays (not mutating in place) ensures React detects the change and re-renders.

The initial state `[""` (one empty string) ensures there's always at least one hint input visible in create mode.

---

## Pattern Toggle Selection

```ts
const togglePattern = (patternId: string) => {
  setSelectedPatterns((prev) =>
    prev.includes(patternId)
      ? prev.filter((id) => id !== patternId)
      : [...prev, patternId]
  );
};
```

Clicking a pattern button either adds or removes it from the selection. The visual feedback uses conditional Tailwind classes:

```tsx
className={selectedPatterns.includes(pat.id)
  ? "bg-indigo-100 text-indigo-700 border-indigo-300"   // Selected
  : "bg-gray-50 text-gray-600 border-gray-200"          // Unselected
}
```

---

## Form Submission

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  let finalTestCases = testCases;
  if (useJsonEditor) {
    try {
      finalTestCases = JSON.parse(testCasesJson);
    } catch {
      alert("Invalid JSON in test cases");
      setSaving(false);
      return;
    }
  }

  const body = {
    title,
    description,
    starterCode,
    solutionCode,
    testCases: finalTestCases,
    tier,
    categoryId,
    hints: hints.filter((h) => h.trim()),
    timeLimit,
    patternIds: selectedPatterns,
  };

  const url = mode === "create"
    ? "/api/problems"
    : `/api/problems/${initialData?.id}`;
  const method = mode === "create" ? "POST" : "PUT";
```

Key details:
- **`e.preventDefault()`** stops the browser's default form submission (which would reload the page)
- **JSON mode validation** — if the user was in JSON editor mode, parse the raw text. If invalid, show an alert and abort.
- **`hints.filter((h) => h.trim())`** strips empty hint inputs. Users often leave blank hint slots; we clean them on submit rather than forcing removal.
- **`router.push("/admin")`** on success navigates back to the admin list — the user sees their changes immediately.
