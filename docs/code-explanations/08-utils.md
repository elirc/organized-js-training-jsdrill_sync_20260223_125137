# `src/lib/utils.ts` — Shared Utility Functions

**What this file does:** Provides small, reusable functions used across both client and server code. These are "pure" utilities — no side effects, no database access, no React hooks.

**Why it matters:** These functions appear everywhere. `generateId()` is called in every API route. `deepEqual()` powers the test runner. `cn()` is in every component. Understanding them saves you from re-inventing wheels.

---

## `generateId()` — UUID Generation

```ts
export function generateId(): string {
  return uuidv4();
}
```

Wraps the `uuid` library's v4 generator. UUIDv4 is randomly generated, so IDs are unpredictable and globally unique without needing a central authority (no auto-increment coordination).

**Why wrap it?** If we ever switch to a different ID strategy (nanoid, CUID, etc.), we change one line here instead of hunting down every `uuidv4()` call. This is the **facade pattern** — a thin wrapper that simplifies replacement.

---

## `now()` — Timestamp Helper

```ts
export function now(): string {
  return new Date().toISOString();
}
```

Returns the current time as an ISO 8601 string like `"2024-01-15T10:30:00.000Z"`. Every `createdAt` and `updatedAt` field in the database is set using this.

ISO format is used because:
- It's timezone-aware (the `Z` means UTC)
- It sorts correctly as a string (no need to parse to compare dates)
- It's human-readable
- SQLite doesn't have a native datetime type, so strings are the standard approach

---

## `generateShareCode()` — Human-Friendly Codes

```ts
export function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

Generates an 8-character share code like `"Xm4kRt9P"`. Notice what's **missing** from the character set:
- No `0` (zero) or `O` (capital O) — they look identical
- No `1` (one), `l` (lowercase L), or `I` (capital I) — same reason

This is called a **confusable-free alphabet**. When users share codes verbally or copy them by hand, `0` vs `O` errors are the #1 frustration. Removing ambiguous characters prevents support headaches.

8 characters from a 55-character alphabet gives 55^8 ≈ 837 billion combinations. Collision probability is negligible for our scale.

---

## `deepEqual()` — Recursive Value Comparison

```ts
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  // ... arrays, objects, recursion
}
```

JavaScript's `===` compares objects by *reference*, not *value*. `[1, 2] === [1, 2]` is `false` because they're two different array objects in memory. `deepEqual` compares by *value* — it recursively checks that the structures contain the same data.

The comparison order matters for performance:
1. **`a === b`** — catches all primitives (numbers, strings, booleans) and same-reference objects. This is the fast path.
2. **Null checks** — `typeof null` returns `"object"` in JavaScript (a famous bug from 1995), so we check for null before the object comparison.
3. **Type check** — different types can never be deeply equal.
4. **Array check** — arrays get element-by-element comparison. Length check first (fast reject).
5. **Object check** — keys are sorted before comparison so `{a: 1, b: 2}` equals `{b: 2, a: 1}`. Without sorting, key insertion order would matter.

**Why not use a library?** Lodash's `_.isEqual` or fast-deep-equal would work, but adding a dependency for one function isn't worth it. Our implementation handles the types our test cases use (primitives, arrays, plain objects). It doesn't handle Maps, Sets, Dates, RegExps, or circular references — but our test cases never contain those.

---

## `cn()` — Conditional Class Names

```ts
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

Used in JSX to conditionally apply CSS classes:
```tsx
<div className={cn("base-class", isActive && "active", size === "lg" && "text-lg")} />
```

`filter(Boolean)` removes all falsy values (`false`, `undefined`, `null`, `""`). The remaining truthy strings get joined with spaces.

This pattern is so common that libraries like `clsx` and `classnames` exist just for this. Ours is simpler (no nested arrays or objects) but handles 99% of use cases in 2 lines.

---

## `tierLabel()` and `tierColor()` — Display Helpers

```ts
export function tierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: "T1 Foundation",
    2: "T2 Combination",
    // ...
  };
  return labels[tier] || `T${tier}`;
}
```

These map tier numbers to human-readable labels and Tailwind CSS classes. The `|| `T${tier}`` fallback handles future tiers beyond 5 without crashing — it just shows a generic label.

Using a lookup object (`Record<number, string>`) instead of a switch statement is more concise and makes the mapping visually scannable.

---

## `formatTime()` — MM:SS Formatting

```ts
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
```

Converts `185` seconds to `"3:05"`. The `padStart(2, "0")` ensures single-digit seconds get a leading zero (`:05` not `:5`). `Math.floor` for integer division, `%` for remainder — standard time formatting.
