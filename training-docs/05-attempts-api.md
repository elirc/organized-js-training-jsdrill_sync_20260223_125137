# Training Doc: Attempts API (`src/app/api/attempts/route.ts`)

## Purpose
This API route is the **single most important backend endpoint** — it's where the drill session connects to the spaced repetition system. When a user submits their attempt, this route: (1) records the attempt in the database, (2) creates or updates the FSRS card for this problem, (3) schedules the next review date, and (4) updates the user's tier progression. It's the bridge between "I just solved a problem" and "when should I see this problem again?"

## Prerequisites
- Understanding of the database schema, especially `attempts`, `userCards`, and `userTierProgress` tables (see `01-schema.md`)
- Understanding of the FSRS system (see `06-fsrs.md`)
- Familiarity with Next.js API routes (`NextResponse`)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–7 — Imports and Constants
```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateId, now } from "@/lib/utils";
import { createNewCard, scheduleNext, cardFromDb, cardToDb } from "@/lib/fsrs";

const DEFAULT_USER_ID = "default-user";
```
**Why this matters:** This route imports from four different modules, showing how it sits at the intersection of multiple systems:
- `db/schema` — for database access
- `utils` — for ID generation and timestamps
- `fsrs` — for the spaced repetition algorithm
- `NextResponse` — for HTTP response formatting

---

### Lines 9–27 — Request Validation
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      problemId, code, approachText, passed,
      timeSpent, timedMode, errorType,
    } = body;

    if (!problemId || code === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
```
**Why this matters:** The function signature `POST(request: Request)` is how Next.js App Router defines HTTP method handlers. The `export async function POST` convention means this handler responds to POST requests at `/api/attempts`.

The validation checks for `problemId` and `code` — the two fields that MUST be present. Notice `code === undefined` instead of `!code` because an empty string (`""`) is a valid submission (the user might have deleted all starter code).

---

### Lines 29–45 — Step 1: Recording the Attempt
```typescript
const timestamp = now();

const attempt = {
  id: generateId(),
  userId: DEFAULT_USER_ID,
  problemId,
  code,
  approachText: approachText || "",
  passed: !!passed,
  timeSpent: timeSpent || 0,
  timedMode: !!timedMode,
  errorType: errorType || null,
  createdAt: timestamp,
};

db.insert(schema.attempts).values(attempt).run();
```
**Why this matters:** This creates the permanent record of the user's attempt. Key patterns:

- **`generateId()`** — Creates a UUID v4 string. Each attempt gets a unique ID.
- **`!!passed`** — Double-negation coerces to boolean. Handles cases where `passed` might be `undefined`, `0`, or `null` from the request body. `!!undefined` → `false`, `!!true` → `true`.
- **`errorType: errorType || null`** — Uses `null` (not `undefined`) for database consistency. SQLite stores `null` explicitly.
- **`.run()`** — Drizzle's method for executing write operations (INSERT, UPDATE, DELETE). For reads, you'd use `.get()` (single row) or `.all()` (multiple rows).

---

### Lines 47–79 — Step 2: Get or Create the FSRS Card
```typescript
let existingCard = db
  .select()
  .from(schema.userCards)
  .where(
    and(
      eq(schema.userCards.userId, DEFAULT_USER_ID),
      eq(schema.userCards.problemId, problemId)
    )
  )
  .get();

const problem = db
  .select()
  .from(schema.problems)
  .where(eq(schema.problems.id, problemId))
  .get();

const timeLimit = problem?.timeLimit || 300;

if (!existingCard) {
  const newCard = createNewCard();
  const cardData = cardToDb(newCard);
  existingCard = {
    id: generateId(),
    userId: DEFAULT_USER_ID,
    problemId,
    ...cardData,
  };
  db.insert(schema.userCards).values(existingCard).run();
}
```
**Why this matters:** This implements the **get-or-create pattern**:

1. **Try to find** an existing FSRS card for this user+problem combination.
2. **`.get()`** returns one row or `undefined` (vs `.all()` which returns an array).
3. **If no card exists** — this is the user's first attempt at this problem. We create a fresh FSRS card using `createNewCard()` (which initializes all FSRS parameters to defaults), convert it to database format with `cardToDb()`, and insert it.
4. **`...cardData`** — The spread operator merges the FSRS fields (stability, difficulty, due, reps, lapses, state, lastReview) into the new card object.
5. **`problem?.timeLimit || 300`** — Optional chaining (`?.`) handles the case where the problem wasn't found. Falls back to 300 seconds (5 minutes).

---

### Lines 81–95 — Step 3: FSRS Scheduling (THE KEY INTEGRATION POINT)
```typescript
const card = cardFromDb(existingCard);
const { card: updatedCard, rating } = scheduleNext(
  card,
  !!passed,
  timeSpent || 0,
  timeLimit,
  !!timedMode
);
const updatedCardData = cardToDb(updatedCard);

db.update(schema.userCards)
  .set(updatedCardData)
  .where(eq(schema.userCards.id, existingCard.id))
  .run();
```
**Why this matters:** This is where the spaced repetition magic happens:

1. **`cardFromDb(existingCard)`** — Converts the database row (strings, numbers) into an FSRS `Card` object (with `Date` objects, enum states). The FSRS library needs proper types.
2. **`scheduleNext(...)`** — The FSRS algorithm determines: (a) what rating to give this attempt (Again/Hard/Good/Easy), and (b) when the user should review this problem next. See `06-fsrs.md` for the rating logic.
3. **Destructuring: `{ card: updatedCard, rating }`** — The `card:` is a rename — the property `card` from the return object is stored as `updatedCard` (because we already have a variable called `card`).
4. **`cardToDb(updatedCard)`** — Converts back to database format (Dates → ISO strings, enums → integers).
5. **`db.update(...).set(...).where(...).run()`** — Updates the existing card row with the new FSRS state, including the new `due` date.

---

### Lines 97–100 — Step 4: Tier Progression
```typescript
if (passed && problem) {
  updateTierProgress(problem.categoryId);
}
```
**Why this matters:** Tier advancement only happens on passing attempts. The `&& problem` guard prevents errors if the problem lookup failed.

---

### Lines 119–151 — The `updateTierProgress` Function
```typescript
function updateTierProgress(categoryId: string) {
  const progress = db
    .select()
    .from(schema.userTierProgress)
    .where(
      and(
        eq(schema.userTierProgress.userId, DEFAULT_USER_ID),
        eq(schema.userTierProgress.categoryId, categoryId)
      )
    )
    .get();

  if (!progress) return;

  const newConsecutive = progress.consecutivePass + 1;

  if (newConsecutive >= 4 && progress.currentTier < 5) {
    db.update(schema.userTierProgress)
      .set({
        currentTier: progress.currentTier + 1,
        consecutivePass: 0,
        tierUnlockedAt: now(),
      })
      .where(eq(schema.userTierProgress.id, progress.id))
      .run();
  } else {
    db.update(schema.userTierProgress)
      .set({ consecutivePass: newConsecutive })
      .where(eq(schema.userTierProgress.id, progress.id))
      .run();
  }
}
```
**Why this matters:** This implements the **tier promotion system**:

- **4 consecutive passes** at the current tier triggers a promotion to the next tier.
- **`progress.currentTier < 5`** — Tier 5 is the maximum. Can't promote beyond it.
- **On promotion:** `currentTier` increments, `consecutivePass` resets to 0, and `tierUnlockedAt` records the timestamp.
- **Otherwise:** Just increment the consecutive pass counter.

**Important note:** The consecutive pass counter is per-category, not per-problem. So passing 4 different Tier 1 Array problems in a row unlocks Tier 2 Arrays. Also note: failed attempts don't reset the counter here — that logic would need to be added for a more robust system.

---

## How This File Connects to the Rest of the App
- **Called by** the drill page (`app/app/page.tsx`) after the user submits their attempt
- **Writes to** `attempts` table (permanent record), `userCards` table (FSRS state), `userTierProgress` table (tier advancement)
- **Uses** `fsrs.ts` for the scheduling algorithm
- **The returned data** (`attemptId`, `rating`, `nextDue`) informs the frontend about scheduling decisions
- **The session builder** reads from `userCards.due` to find overdue reviews — this route is what sets those due dates

## Key Takeaways
1. This route performs 4 distinct operations in sequence: record attempt → get/create card → FSRS schedule → tier update
2. The get-or-create pattern handles both first-time and returning attempts
3. `cardFromDb`/`cardToDb` handle type conversion between the database and the FSRS library
4. 4 consecutive passes promote to the next tier (max tier 5)
5. This is the write path — the session builder is the read path — together they form the spaced repetition loop
