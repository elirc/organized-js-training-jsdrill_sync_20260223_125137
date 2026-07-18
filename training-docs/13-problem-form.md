# Training Doc: Problem Form Component (`src/components/admin/ProblemForm.tsx`)

## Purpose
This is the **admin interface for creating and editing coding problems**. It's the most complex form in the application, handling: text inputs, dropdowns, code textareas, a dynamic test case builder (with both form-based and JSON editor modes), a hints list, and a pattern selector. Understanding this file teaches patterns for building complex, multi-section forms in React.

## Prerequisites
- React state management with `useState`
- Controlled form components in React
- Understanding of the problem data model (see `01-schema.md`)
- TypeScript generics and type definitions

---

## Line-by-Line Walkthrough of Key Code

### Lines 15–30 — Props and Mode
```typescript
type ProblemFormProps = {
  initialData?: {
    id?: string;
    title: string;
    description: string;
    starterCode: string;
    solutionCode: string;
    testCases: TestCase[];
    tier: number;
    categoryId: string;
    hints: string[];
    timeLimit: number;
    patternIds: string[];
  };
  mode: "create" | "edit";
};
```
**Why this matters:** The form is **dual-mode** — the same component handles both creating new problems and editing existing ones:
- **`mode: "create" | "edit"`** — Controls the API endpoint used and the submit button text.
- **`initialData?`** — Optional. When editing, this is pre-populated from the existing problem. When creating, it's `undefined` and defaults are used.
- **`id?: string`** — Only present in edit mode. Used to construct the PATCH URL.

---

### Lines 32–55 — State Initialization (CONTROLLED FORM PATTERN)
```typescript
export function ProblemForm({ initialData, mode }: ProblemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [starterCode, setStarterCode] = useState(
    initialData?.starterCode || "function solution() {\n  // your code here\n}"
  );
  ...
  const [testCases, setTestCases] = useState<TestCase[]>(
    initialData?.testCases || [
      { input: [], expected: null, description: "", isEdgeCase: false },
    ]
  );
  const [testCasesJson, setTestCasesJson] = useState(
    JSON.stringify(initialData?.testCases || [], null, 2)
  );
  const [useJsonEditor, setUseJsonEditor] = useState(false);
```
**Why this matters:** Every form field has its own state variable. This is the **controlled component pattern** — React owns the form state, and inputs reflect that state. Key details:

- **`initialData?.title || ""`** — Optional chaining (`?.`) returns `undefined` if `initialData` is missing, then `||` falls back to an empty string. This means the form works for both create (empty fields) and edit (pre-populated fields).
- **`testCases` AND `testCasesJson`** — Two separate states for the same data! The form has two editing modes: a structured form editor and a raw JSON editor. They're kept in sync when switching between modes.
- **`useJsonEditor`** — Toggles between the two test case editing modes.
- **`saving`** — Disables the submit button while the API call is in progress to prevent double-submits.

---

### Lines 57–70 — Loading Categories and Patterns
```typescript
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
**Why this matters:** The form needs dropdown options for categories and patterns, which come from the API:

- **`Promise.all([...])`** — Fires both API calls in parallel and waits for both to complete. This is faster than sequential fetches (saves one network round-trip).
- **`([catRes, patRes])`** — `Promise.all` returns results in the same order as the input array. We destructure them for clarity.
- **Default category selection** — `if (!categoryId && catRes.data.length > 0)` sets the first category as default ONLY when creating a new problem (when `categoryId` is empty). During editing, the existing value is preserved.

---

### Lines 72–124 — Form Submission Handler
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);

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
```
**Why this matters:**
- **`e.preventDefault()`** — Prevents the browser's default form submission (which would cause a page reload).
- **JSON editor validation** — If the user is in JSON mode, we try to parse their input. If it's invalid JSON, we show an alert and abort. The `catch` without a parameter (`catch {` instead of `catch (e) {`) is valid when you don't need the error object.

```typescript
  const body = { title, description, starterCode, solutionCode,
    testCases: finalTestCases, tier, categoryId,
    hints: hints.filter((h) => h.trim()),
    timeLimit, patternIds: selectedPatterns,
  };

  const url = mode === "create"
    ? "/api/problems"
    : `/api/problems/${initialData?.id}`;
  const method = mode === "create" ? "POST" : "PUT";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
```
**Why this matters:**
- **`hints.filter((h) => h.trim())`** — Removes empty hints. If the user added a hint input but left it blank, it's excluded.
- **Mode-dependent URL and method** — Create uses `POST /api/problems`, edit uses `PUT /api/problems/{id}`.
- **`router.push("/admin")`** — On success, navigates back to the admin list using Next.js client-side navigation.

---

### Lines 126–132 — Pattern Toggle
```typescript
const togglePattern = (patternId: string) => {
  setSelectedPatterns((prev) =>
    prev.includes(patternId)
      ? prev.filter((id) => id !== patternId)
      : [...prev, patternId]
  );
};
```
**Why this matters:** This implements **toggle behavior** on the pattern selection buttons:
- If the pattern is already selected → remove it (filter it out)
- If not selected → add it (spread existing + new)

The **functional updater** `(prev) => ...` is used because the new state depends on the previous state. This prevents stale state bugs when multiple rapid clicks happen.

---

### Lines 246–331 — Dynamic Test Case Builder
```typescript
{testCases.map((tc, i) => (
  <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2">
    <Input
      placeholder="Description"
      value={tc.description}
      onChange={(e) => {
        const updated = [...testCases];
        updated[i] = { ...tc, description: e.target.value };
        setTestCases(updated);
      }}
    />
    <div className="grid grid-cols-2 gap-2">
      <Input
        placeholder='Input args as JSON array'
        value={JSON.stringify(tc.input)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            const updated = [...testCases];
            updated[i] = { ...tc, input: parsed };
            setTestCases(updated);
          } catch {
            // Let them type — don't block input on invalid JSON
          }
        }}
      />
```
**Why this matters:** This is a **dynamic list** where users can add/remove test cases:

- **`key={i}`** — Uses index as key. This is usually discouraged (keys should be stable), but it's acceptable here because test cases don't have IDs and reordering isn't supported.
- **Immutable update pattern** — `const updated = [...testCases]; updated[i] = { ...tc, description: e.target.value };` creates a new array with a new object at position `i`. React requires immutable updates to detect state changes.
- **Silent JSON parse failure** — The input/expected fields store JSON, and parsing is attempted on every keystroke. During typing, the value might be temporarily invalid JSON (e.g., `[1, ` while typing `[1, 2]`). The `catch {}` silently ignores parse failures, letting the user continue typing freely.

---

## How This File Connects to the Rest of the App
- **Used by** `admin/problems/new/page.tsx` (create mode) and `admin/problems/[id]/edit/page.tsx` (edit mode)
- **Fetches from** `GET /api/categories` and `GET /api/patterns` for dropdown options
- **Submits to** `POST /api/problems` (create) or `PUT /api/problems/{id}` (edit)
- **Uses** `Input`, `Textarea`, `Select`, `Button`, `Card` UI primitives

## Key Takeaways
1. Dual-mode forms (create/edit) use optional `initialData` with defaults
2. `Promise.all` parallelizes independent API calls
3. Immutable state updates are required for React to detect changes
4. Silent try/catch in onChange handlers allows free typing of JSON values
5. The toggle pattern with functional state updaters prevents stale state bugs
6. Keeping form + JSON editor states separately allows mode switching
