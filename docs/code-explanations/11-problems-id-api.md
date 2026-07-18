# `src/app/api/problems/[id]/route.ts` — Problem CRUD API

**What this file does:** Handles GET, PUT, and DELETE for individual problems at `/api/problems/:id`. This powers the admin panel's edit and delete functionality, plus loading a single problem's full details.

**Why it matters:** This is the most complete CRUD endpoint in the app — it demonstrates all three read/update/delete operations with proper error handling, data transformation, and cascade deletes.

---

## The Dynamic Route Segment

The `[id]` in the file path is a Next.js **dynamic route segment**. When a request hits `/api/problems/prob-str-t1-reverse`, Next.js passes `{ params: { id: "prob-str-t1-reverse" } }` to the handler.

```ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
```

In Next.js App Router, `params` is a Promise that must be awaited. The `_request` parameter is prefixed with `_` because we don't use it — the underscore is a convention meaning "intentionally unused."

---

## GET: Reading with Enrichment

```ts
const problem = db.select()
  .from(schema.problems)
  .where(eq(schema.problems.id, id))
  .get();
```

`.get()` returns a single row or `undefined`. If `undefined`, we return a 404.

The response enriches the raw database row:
```ts
return NextResponse.json({
  success: true,
  data: {
    ...problem,
    testCases: JSON.parse(problem.testCases),
    hints: JSON.parse(problem.hints),
    categoryName: category?.name || "Unknown",
    patternIds: patternLinks.map((pl) => pl.patternId),
  },
});
```

Three transformations:
1. **`JSON.parse`** — `testCases` and `hints` are stored as JSON strings in SQLite. The client expects parsed arrays.
2. **`categoryName`** — The client needs the display name, not just the foreign key `categoryId`.
3. **`patternIds`** — Instead of the full pattern objects, the edit form just needs the IDs (to pre-check the pattern toggles).

The spread `...problem` passes through all other fields unchanged. This is a common pattern: spread the base data, then override/add specific fields.

---

## PUT: Partial Updates with Nullish Coalescing

```ts
db.update(schema.problems)
  .set({
    title: title ?? existing.title,
    description: description ?? existing.description,
    starterCode: starterCode ?? existing.starterCode,
    testCases: testCases ? JSON.stringify(testCases) : existing.testCases,
    // ...
  })
  .where(eq(schema.problems.id, id))
  .run();
```

The `??` operator (**nullish coalescing**) returns the right side only if the left is `null` or `undefined`. This enables partial updates — if the client sends `{ title: "New Title" }` without `description`, the description keeps its existing value.

**Why `??` instead of `||`?** The `||` operator also triggers on `0`, `""`, and `false`. If someone sets `timeLimit` to `0`, `timeLimit || existing.timeLimit` would ignore the `0` and keep the old value. `timeLimit ?? existing.timeLimit` correctly uses `0`.

**Special case for JSON fields:**
```ts
testCases: testCases ? JSON.stringify(testCases) : existing.testCases,
```

`testCases` uses `?` (truthy check) instead of `??` because the value arrives as a parsed array from the client and needs `JSON.stringify()` before storage. If no testCases were sent, we keep the existing string as-is (no parse/stringify roundtrip).

---

## PUT: Pattern Link Updates (Delete-and-Recreate)

```ts
if (patternIds) {
  db.delete(schema.problemPatterns)
    .where(eq(schema.problemPatterns.problemId, id))
    .run();

  for (const patternId of patternIds) {
    db.insert(schema.problemPatterns)
      .values({ problemId: id, patternId })
      .onConflictDoNothing()
      .run();
  }
}
```

Updating many-to-many relationships is tricky. The simplest approach: delete all existing links, then insert the new ones. This is the **delete-and-recreate** pattern.

Why not diff the changes? Computing "add these 2, remove these 1, keep these 3" is more code, more bug-prone, and not noticeably faster for small sets. The delete-and-recreate approach is O(n) and correct by construction.

`onConflictDoNothing()` is a safety net — if the same pattern ID appears twice in the array, it won't throw a duplicate key error.

---

## DELETE: Cascade Through Join Tables

```ts
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Delete pattern links first
  db.delete(schema.problemPatterns)
    .where(eq(schema.problemPatterns.problemId, id))
    .run();

  // 2. Then delete the problem
  db.delete(schema.problems)
    .where(eq(schema.problems.id, id))
    .run();
```

Order matters. The `problemPatterns` table has a foreign key to `problems`. If you delete the problem first, the foreign key constraint would fail (we enabled foreign keys in `db/index.ts`). So we delete the join table rows first, then the problem.

**What's not deleted:** User cards and attempts referencing this problem are *not* cleaned up. This is intentional — the learning history is valuable even if the problem is removed. In a production app, you might soft-delete (set `isPublished = false`) instead of hard-deleting.

---

## Error Handling Pattern

All three handlers follow the same pattern:

```ts
try {
  // ... business logic ...
  return NextResponse.json({ success: true, data: ... });
} catch (error) {
  console.error("Problem [operation] error:", error);
  return NextResponse.json(
    { success: false, error: "Failed to [operation]" },
    { status: 500 }
  );
}
```

The `console.error` logs the full error server-side (visible in the terminal). The client gets a sanitized message without stack traces or internal details. This is a security best practice — never expose internal errors to the client.
