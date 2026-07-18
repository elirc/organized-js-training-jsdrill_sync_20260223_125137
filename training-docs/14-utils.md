# Training Doc: Utilities (`src/lib/utils.ts`)

## Purpose
This file contains **shared utility functions** used across the entire application. Every function here solves a common, reusable problem: generating IDs, formatting time, comparing values, constructing CSS classes, and labeling tiers. Understanding these utilities helps you read any file in the project, since they appear everywhere.

## Prerequisites
- Basic JavaScript: string manipulation, object comparison, array methods
- The `uuid` npm package
- Concept of utility functions (small, pure, reusable)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–5 — UUID Generation
```typescript
import { v4 as uuidv4 } from "uuid";

export function generateId(): string {
  return uuidv4();
}
```
**Why this matters:** Every entity in the database (problems, attempts, users, cards) uses a UUID as its primary key. `uuidv4()` generates a random UUID like `"550e8400-e29b-41d4-a716-446655440000"`. We wrap it in a named function so:
1. If we ever switch UUID libraries, we change one line
2. The call site reads `generateId()` which is more descriptive than `uuidv4()`

**Why UUIDs instead of auto-increment integers?** UUIDs can be generated client-side without consulting the database, they're globally unique (safe for distributed systems), and they prevent enumeration attacks (you can't guess the next ID).

---

### Lines 7–9 — Timestamp Helper
```typescript
export function now(): string {
  return new Date().toISOString();
}
```
**Why this matters:** Used everywhere that records a timestamp (attempts, tier progress, etc.). `toISOString()` produces strings like `"2024-03-15T10:30:00.000Z"` which are:
- Human-readable
- Sortable as strings (lexicographic order matches chronological order)
- Parseable by `new Date()`
- Timezone-aware (always UTC, indicated by the `Z` suffix)

---

### Lines 11–18 — Share Code Generation
```typescript
export function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```
**Why this matters:** Generates short codes for sharing (e.g., `"xK3mP9nQ"`). Notice the **character set is carefully curated**:
- Missing: `I`, `l`, `O`, `0`, `1` — These are excluded because they look similar in many fonts (`I` vs `l`, `O` vs `0`). This prevents user confusion when typing share codes.
- 8 characters from a 54-character alphabet = ~54^8 ≈ 72 trillion possible codes. More than enough to avoid collisions.

---

### Lines 20–42 — Deep Equality (`deepEqual`) (CRITICAL UTILITY)
```typescript
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keysA = Object.keys(aObj).sort();
    const keysB = Object.keys(bObj).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (key, i) => key === keysB[i] && deepEqual(aObj[key], bObj[key])
    );
  }

  return false;
}
```
**Why this matters:** This is used by the executor to compare user output against expected values. JavaScript's `===` only checks reference equality for objects/arrays (`[1,2] === [1,2]` is `false`). This function does **structural comparison**:

1. **`a === b`** — Handles primitives (numbers, strings, booleans) and same-reference objects.
2. **`a === null || b === null`** — If either is null (but not both, since `===` already handled that), they're not equal.
3. **`typeof a !== typeof b`** — Different types can't be equal.
4. **Array comparison** — Check lengths match, then recursively compare each element. `a.every((val, i) => deepEqual(val, b[i]))` checks every element at the same index.
5. **Object comparison** — Get sorted keys (sorting ensures `{a:1, b:2}` equals `{b:2, a:1}`), verify same number of keys, then recursively compare each value.
6. **`return false`** — If none of the above matched, the values aren't equal (covers functions, symbols, etc.).

The `as Record<string, unknown>` cast is needed because TypeScript doesn't know the exact shape of `unknown` objects.

---

### Lines 44–46 — CSS Class Utility (`cn`)
```typescript
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
```
**Why this matters:** A tiny but powerful utility for conditional CSS classes. Usage:
```typescript
cn("base-class", isActive && "active", isHidden && "hidden")
// If isActive=true, isHidden=false: "base-class active"
// If isActive=false, isHidden=true: "base-class hidden"
```

- **`...classes`** — Rest parameter collects all arguments into an array.
- **`(string | false | undefined | null)[]`** — Accepts strings, `false`, `undefined`, or `null`. The `false` type is important because `condition && "class"` evaluates to `false` when the condition is falsy.
- **`.filter(Boolean)`** — Removes all falsy values (`false`, `undefined`, `null`, `""`).
- **`.join(" ")`** — Combines remaining strings with spaces.

This is a lightweight alternative to the `classnames` or `clsx` npm packages.

---

### Lines 48–68 — Tier Labels and Colors
```typescript
export function tierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: "T1 Foundation",
    2: "T2 Combination",
    3: "T3 Edge-Aware",
    4: "T4 Multi-Step",
    5: "T5 Interview-Ready",
  };
  return labels[tier] || `T${tier}`;
}

export function tierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: "bg-green-100 text-green-800",
    2: "bg-blue-100 text-blue-800",
    3: "bg-yellow-100 text-yellow-800",
    4: "bg-orange-100 text-orange-800",
    5: "bg-red-100 text-red-800",
  };
  return colors[tier] || "bg-gray-100 text-gray-800";
}
```
**Why this matters:** These lookup functions convert tier numbers to display strings. Using `Record<number, string>` as the type is cleaner than a `switch` statement. The `|| fallback` handles unexpected tier values gracefully.

The color progression (green → blue → yellow → orange → red) visually communicates increasing difficulty — a nice UX touch that maps to intuitive color associations.

---

### Lines 70–74 — Time Formatting
```typescript
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
```
**Why this matters:** Converts seconds to `"M:SS"` format (e.g., 125 seconds → `"2:05"`):
- `Math.floor(seconds / 60)` — Integer division for minutes
- `seconds % 60` — Modulo for remaining seconds
- `.padStart(2, "0")` — Ensures seconds is always 2 digits (`"5"` → `"05"`)

Used by the `SessionProgress` component to display the timer.

---

## How This File Connects to the Rest of the App
- **`generateId()`** — Used by every API route that creates database records
- **`now()`** — Used by every API route that records timestamps
- **`deepEqual()`** — Used by `executor.ts` to compare test results
- **`cn()`** — Used by UI components for conditional CSS classes
- **`tierLabel()`/`tierColor()`** — Used by `ProblemCard`, `Badge`, admin pages
- **`formatTime()`** — Used by `SessionProgress` for the timer display

## Key Takeaways
1. Utility functions should be small, pure (no side effects), and well-named
2. Wrapping library calls (`uuidv4` → `generateId`) creates a facade for easier refactoring
3. `deepEqual` handles the recursive comparison that `===` can't do for objects/arrays
4. The `cn` utility is a lightweight classnames alternative
5. `Record<K, V>` is a clean pattern for lookup tables
