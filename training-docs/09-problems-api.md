# Training Doc: Problems API (`src/app/api/problems/route.ts`)

## Purpose
This API route handles **CRUD operations** (Create, Read, Update, Delete) for coding problems. It's the backbone of the admin panel — every problem that exists in the system was either seeded from JSON files or created through this endpoint. The GET handler demonstrates data enrichment patterns, and the POST handler shows how to handle complex creates with related entities.

## Prerequisites
- Understanding of the database schema, especially `problems`, `categories`, and `problemPatterns` tables (see `01-schema.md`)
- Familiarity with REST API conventions (GET = list, POST = create)
- Drizzle ORM query patterns

---

## Line-by-Line Walkthrough of Key Code

### Lines 7–47 — GET: List All Problems (with Enrichment)
```typescript
export async function GET() {
  try {
    const allProblems = db
      .select()
      .from(schema.problems)
      .orderBy(asc(schema.problems.tier), asc(schema.problems.title))
      .all();
```
**Why this matters:**
- **`export async function GET()`** — No `request` parameter is needed because this endpoint doesn't use query params or body. Next.js allows omitting unused parameters.
- **`.orderBy(asc(schema.problems.tier), asc(schema.problems.title))`** — Multiple sort keys: first by tier (easiest first), then alphabetically within the same tier. This ensures a consistent, logical ordering in the admin list.
- **`.all()`** — Returns all matching rows as an array. This is a Drizzle method for SQLite's synchronous API.

```typescript
    const enriched = allProblems.map((p) => {
      const category = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, p.categoryId))
        .get();

      const patternLinks = db
        .select()
        .from(schema.problemPatterns)
        .where(eq(schema.problemPatterns.problemId, p.id))
        .all();

      const patternIds = patternLinks.map((pl) => pl.patternId);

      return {
        ...p,
        testCases: JSON.parse(p.testCases),
        hints: JSON.parse(p.hints),
        categoryName: category?.name || "Unknown",
        patternIds,
      };
    });
```
**Why this matters:** This is the **enrichment pattern** — transforming raw database rows into richer objects:

- **N+1 query pattern** — For each problem, we run 2 additional queries (category lookup + pattern links). With 20 problems, that's 40 extra queries. This is the classic "N+1 problem" in ORMs. It works fine for a small dataset like this, but for hundreds of problems, you'd want to use JOINs or batch loading instead.
- **`...p`** — The spread operator copies all original problem fields, then we add/override specific ones.
- **`JSON.parse(p.testCases)`** — Converts the JSON string stored in SQLite back into a JavaScript array. This is necessary because SQLite doesn't have a native JSON type.
- **`category?.name || "Unknown"`** — Optional chaining with a fallback. If the category was deleted but the problem still references it, we show "Unknown" instead of crashing.
- **`patternIds`** — The frontend needs to know which patterns are associated with each problem (for the admin form's pattern toggle buttons).

---

### Lines 50–114 — POST: Create a New Problem
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title, description, starterCode, solutionCode,
      testCases, tier, categoryId, hints,
      timeLimit, patternIds, authorId,
    } = body;

    if (!title || !description || !starterCode || !categoryId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
```
**Why this matters:**
- **Destructuring** extracts all expected fields from the request body in one statement.
- **Validation** checks only the truly required fields. Note: `testCases`, `tier`, `hints`, `timeLimit` are NOT required — they have defaults.
- **`{ status: 400 }`** — HTTP 400 = Bad Request, meaning the client sent invalid data.

```typescript
    const timestamp = now();
    const id = generateId();

    db.insert(schema.problems)
      .values({
        id,
        title,
        description,
        starterCode,
        solutionCode: solutionCode || "",
        testCases: JSON.stringify(testCases || []),
        tier: tier || 1,
        categoryId,
        authorId: authorId || null,
        hints: JSON.stringify(hints || []),
        timeLimit: timeLimit || 300,
        isPublished: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
```
**Why this matters:** The insert uses defensive defaults for every optional field:
- **`solutionCode || ""`** — Default to empty string if not provided.
- **`JSON.stringify(testCases || [])`** — Convert arrays back to JSON strings for storage. The `|| []` ensures valid JSON even if the field is missing.
- **`tier || 1`** — Default to Tier 1 (Foundation) for new problems.
- **`authorId || null`** — `null` means it's a system problem. If an `authorId` is provided, it's a user-created problem.
- **Both `createdAt` and `updatedAt`** get the same timestamp on creation.

```typescript
    if (patternIds && patternIds.length > 0) {
      for (const patternId of patternIds) {
        db.insert(schema.problemPatterns)
          .values({ problemId: id, patternId })
          .onConflictDoNothing()
          .run();
      }
    }
```
**Why this matters:** After creating the problem, we link it to patterns via the junction table:
- **`onConflictDoNothing()`** — If someone accidentally sends the same pattern twice, this silently ignores the duplicate instead of throwing a constraint violation error. The composite primary key on `problemPatterns` (problemId + patternId) prevents duplicates at the database level.
- **Sequential inserts in a loop** — For a small number of patterns (typically 1-2), this is fine. For bulk operations, you'd want a batch insert.

---

## How This File Connects to the Rest of the App
- **Called by** the admin page and ProblemForm component for listing and creating problems
- **Reads from** `problems`, `categories`, `problemPatterns` tables
- **Writes to** `problems` and `problemPatterns` tables
- **The enriched data** is used by admin UI to display category names and pattern associations
- **The companion route** `problems/[id]/route.ts` handles single-problem GET, PATCH, and DELETE

## Key Takeaways
1. The GET handler demonstrates the N+1 enrichment pattern (fine for small datasets)
2. POST validation only checks truly required fields, with defaults for everything else
3. `JSON.stringify`/`JSON.parse` bridges between JavaScript objects and SQLite text columns
4. `onConflictDoNothing()` handles duplicate junction table entries gracefully
5. The `...spread` operator makes it easy to add computed fields to database rows
