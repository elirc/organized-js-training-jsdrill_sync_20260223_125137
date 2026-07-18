# Training Doc: Session API Route (`src/app/api/session/route.ts`)

## Purpose
This is the **API entry point** for building drill sessions. When the user opens the practice page, the frontend calls this endpoint to get a queue of problems. It's a thin route that delegates the heavy lifting to `sessionBuilder.ts`, but it demonstrates important Next.js API route patterns and input validation.

## Prerequisites
- Understanding of Next.js App Router API routes
- Understanding of the session builder (see `02-session-builder.md`)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–2 — Imports
```typescript
import { NextResponse } from "next/server";
import { buildSession } from "@/lib/sessionBuilder";
```
**Why this matters:** Next.js API routes use `NextResponse` (not Express's `res.json()`). The `@/` path alias maps to `src/`, configured in `tsconfig.json`. This means `@/lib/sessionBuilder` resolves to `src/lib/sessionBuilder.ts`.

---

### Lines 4–19 — The GET Handler (ENTIRE ROUTE)
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get("size") || "10", 10);
  const clampedSize = Math.max(1, Math.min(size, 20));

  try {
    const problems = await buildSession(clampedSize);
    return NextResponse.json({ success: true, data: problems });
  } catch (error) {
    console.error("Session build error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to build session" },
      { status: 500 }
    );
  }
}
```
**Why this matters:** Despite being only 16 lines, this route demonstrates several important patterns:

**Parsing Query Parameters (lines 5-7):**
```typescript
const { searchParams } = new URL(request.url);
const size = parseInt(searchParams.get("size") || "10", 10);
const clampedSize = Math.max(1, Math.min(size, 20));
```
- **`new URL(request.url)`** — In Next.js App Router, you parse the URL manually (unlike Pages Router which provided `req.query`). `searchParams` is a `URLSearchParams` object.
- **`searchParams.get("size") || "10"`** — If the `size` parameter is missing or empty, default to `"10"`. The `||` operator works because `.get()` returns `null` for missing params.
- **`parseInt(..., 10)`** — The second argument `10` specifies base-10 (decimal). Always include this — without it, strings like `"08"` might be parsed as octal in some environments.
- **`Math.max(1, Math.min(size, 20))`** — **Input clamping.** This is a defensive pattern that ensures `size` stays between 1 and 20 regardless of what the client sends. `Math.min(size, 20)` caps at 20, then `Math.max(1, ...)` ensures at least 1. This prevents abuse (requesting 10,000 problems) and invalid values (0 or negative).

**The try/catch Pattern (lines 9-17):**
```typescript
try {
  const problems = await buildSession(clampedSize);
  return NextResponse.json({ success: true, data: problems });
} catch (error) {
  console.error("Session build error:", error);
  return NextResponse.json(
    { success: false, error: "Failed to build session" },
    { status: 500 }
  );
}
```
- **`await buildSession(clampedSize)`** — Delegates to the session builder. The route doesn't contain any business logic — it only handles HTTP concerns (parsing request, formatting response, error handling).
- **`{ success: true, data: problems }`** — Follows the `ApiResponse` convention from `types/index.ts`. Every API response has a `success` boolean.
- **`{ status: 500 }`** — The second argument to `NextResponse.json()` sets the HTTP status code. 500 = Internal Server Error.
- **`console.error` before the error response** — Logs the full error (with stack trace) on the server for debugging, but sends only a generic message to the client. This is a security best practice — never expose internal error details to users.

---

## Architecture Pattern: Thin Routes + Fat Services

This file exemplifies the **thin controller, fat service** pattern:

| Layer | Responsibility | This File |
|-------|---------------|-----------|
| **Route (Controller)** | Parse HTTP request, validate input, return HTTP response | `session/route.ts` |
| **Service (Business Logic)** | Build the session queue, query database, apply algorithms | `sessionBuilder.ts` |

The route is intentionally simple. If you need to change how sessions are built, you modify `sessionBuilder.ts`. If you need to change the HTTP API shape (add pagination, authentication), you modify this route. This separation makes testing easier — you can test `buildSession()` without HTTP, and test the route without a real database.

---

## How This File Connects to the Rest of the App
- **Called by** the drill page (`app/app/page.tsx`) via `fetch("/api/session?size=10")`
- **Delegates to** `sessionBuilder.ts` which queries the database
- **Returns** `{ success: true, data: SessionProblem[] }` consumed by the drill page

## Key Takeaways
1. Next.js App Router API routes export named functions matching HTTP methods (GET, POST, etc.)
2. Input clamping prevents abuse and invalid values
3. The thin route / fat service pattern keeps HTTP concerns separate from business logic
4. Always parse query params with defaults and validation
5. Log full errors server-side, send generic messages to clients
