import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { now } from "@/lib/utils";

// GET: Get a single problem
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const problem = db
      .select()
      .from(schema.problems)
      .where(eq(schema.problems.id, id))
      .get();

    if (!problem) {
      return NextResponse.json(
        { success: false, error: "Problem not found" },
        { status: 404 }
      );
    }

    const category = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, problem.categoryId))
      .get();

    const patternLinks = db
      .select()
      .from(schema.problemPatterns)
      .where(eq(schema.problemPatterns.problemId, id))
      .all();

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
  } catch (error) {
    console.error("Problem fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch problem" },
      { status: 500 }
    );
  }
}

// PUT: Update a problem
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const {
      title,
      description,
      starterCode,
      solutionCode,
      testCases,
      tier,
      categoryId,
      hints,
      timeLimit,
      patternIds,
      isPublished,
    } = body;

    const existing = db
      .select()
      .from(schema.problems)
      .where(eq(schema.problems.id, id))
      .get();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Problem not found" },
        { status: 404 }
      );
    }

    db.update(schema.problems)
      .set({
        title: title ?? existing.title,
        description: description ?? existing.description,
        starterCode: starterCode ?? existing.starterCode,
        solutionCode: solutionCode ?? existing.solutionCode,
        testCases: testCases ? JSON.stringify(testCases) : existing.testCases,
        tier: tier ?? existing.tier,
        categoryId: categoryId ?? existing.categoryId,
        hints: hints ? JSON.stringify(hints) : existing.hints,
        timeLimit: timeLimit ?? existing.timeLimit,
        isPublished: isPublished ?? existing.isPublished,
        updatedAt: now(),
      })
      .where(eq(schema.problems.id, id))
      .run();

    // Update pattern links if provided
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

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Problem update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update problem" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a problem
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    db.delete(schema.problemPatterns)
      .where(eq(schema.problemPatterns.problemId, id))
      .run();
    db.delete(schema.problems)
      .where(eq(schema.problems.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Problem delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete problem" },
      { status: 500 }
    );
  }
}
