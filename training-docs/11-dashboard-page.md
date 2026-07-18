# Training Doc: Dashboard Page (`src/app/app/dashboard/page.tsx`)

## Purpose
This is the **analytics dashboard** where users track their progress. It fetches aggregated data from the dashboard API and renders it through three visualization components (HeatMap, CategoryStrength, PatternMap) plus summary statistics. It demonstrates a clean pattern for data-fetching pages with loading and error states.

## Prerequisites
- React hooks (`useState`, `useEffect`)
- Understanding of the dashboard API response shape (see `10-dashboard-api.md`)
- TypeScript types for dashboard data (see `07-types.md`)
- The "use client" directive (see `03-drill-page.md`)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–8 — Imports and Setup
```typescript
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { HeatMap } from "@/components/dashboard/HeatMap";
import { CategoryStrength } from "@/components/dashboard/CategoryStrength";
import { PatternMap } from "@/components/dashboard/PatternMap";
import type { CategoryProgress, PatternStrength, DayActivity } from "@/types";
```
**Why this matters:** Notice the `import type` keyword — this imports ONLY the TypeScript type, not any runtime code. TypeScript erases `import type` during compilation, so it produces zero bytes in the JavaScript bundle. Use `import type` whenever you're importing something only for type annotations.

---

### Lines 10–19 — Local Type Definition
```typescript
type DashboardData = {
  categoryProgress: CategoryProgress[];
  activity: DayActivity[];
  patternStrengths: PatternStrength[];
  stats: {
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
  };
};
```
**Why this matters:** This type describes the exact shape of the dashboard API response's `data` field. It's defined locally (not in `types/index.ts`) because it's only used by this one page. This is a good practice — don't pollute the shared types file with types that are only used in one place.

Note how it composes types from `types/index.ts` (`CategoryProgress[]`, `DayActivity[]`, `PatternStrength[]`) with an inline `stats` object type. This shows TypeScript's flexibility — you can mix imported types with ad-hoc definitions.

---

### Lines 21–33 — Data Fetching
```typescript
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
```
**Why this matters:** This is a standard **fetch-on-mount pattern** for client components:

- **`useState<DashboardData | null>(null)`** — The data starts as `null` (not loaded yet). The union type `DashboardData | null` makes TypeScript enforce null checks before accessing data fields.
- **`useEffect(() => { ... }, [])`** — The empty dependency array `[]` means this runs once on mount. It won't re-run on re-renders.
- **Promise chain vs async/await** — This uses `.then()` chains instead of `async/await`. Both patterns work; this is a stylistic choice. The `.then()` chain is slightly more concise for simple sequences.
- **`.catch(console.error)`** — Shorthand for `.catch((err) => console.error(err))`. If the fetch fails, the error is logged but the page doesn't crash.
- **`.finally(() => setLoading(false))`** — `finally` runs regardless of success or failure. This ensures the loading spinner disappears even if the API call fails.
- **`if (json.success) setData(json.data)`** — Only sets data if the API reports success. If the API returned an error, `data` stays `null` and the error state renders.

---

### Lines 35–49 — Loading and Error States
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

if (!data) {
  return (
    <Card padding="lg" className="text-center">
      <p className="text-gray-500">Failed to load dashboard data.</p>
    </Card>
  );
}
```
**Why this matters:** These **guard returns** handle the two non-happy states before rendering the main UI:

- **Loading state** — A CSS-only spinner animation. `animate-spin` is a Tailwind utility that applies a continuous rotation. The `border-t-transparent` makes one side of the border invisible, creating the spinner effect. No JavaScript animation needed.
- **Error state** — If `data` is still `null` after loading completes, the API call failed. This is a simple fallback — a production app might add a retry button.

The **early return pattern** keeps the main render logic clean. By the time we reach the main JSX, we're guaranteed that `data` is not null, and TypeScript knows this too (it narrows the type automatically).

---

### Lines 51–98 — Main Dashboard Render
```typescript
return (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

    {/* Stats row */}
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-600">
            {data.stats.totalAttempts}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Attempts</div>
        </div>
      </Card>
      ...two more stat cards...
    </div>

    <Card><HeatMap activity={data.activity} /></Card>
    <Card><CategoryStrength categories={data.categoryProgress} /></Card>
    <Card><PatternMap patterns={data.patternStrengths} /></Card>
  </div>
);
```
**Why this matters:** The layout uses several key patterns:

- **`space-y-6`** — Tailwind utility that adds `margin-top: 1.5rem` to every child except the first. This is cleaner than adding margins to individual elements.
- **`grid grid-cols-3 gap-4`** — CSS Grid with 3 equal columns and gaps between them. The three stat cards are arranged in a row.
- **Component composition** — Each visualization is wrapped in a `Card` and receives its specific data slice as props. The dashboard page doesn't know HOW to render a heatmap — it just passes data to `HeatMap` and lets it handle the rendering. This is the **container/presentational component pattern**.

---

## How This File Connects to the Rest of the App
- **Fetches from** `GET /api/dashboard` which aggregates data from 7 tables
- **Renders** `HeatMap`, `CategoryStrength`, `PatternMap` components
- **Uses** `Card` UI primitive for consistent styling
- **Accessible at** `/app/dashboard` via the app navigation

## Key Takeaways
1. `import type` prevents type-only imports from bloating the bundle
2. Local type definitions keep the shared types file clean
3. The fetch-on-mount pattern with loading/error/success states is reusable everywhere
4. Guard returns (early returns) simplify the main render logic
5. CSS-only spinners via Tailwind are lightweight and performant
6. Container components (this page) pass data to presentational components (HeatMap, etc.)
