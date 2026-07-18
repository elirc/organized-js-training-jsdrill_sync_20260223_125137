import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, isNull, asc } from "drizzle-orm";
import { generateId, now } from "@/lib/utils";

// GET: List all problems (with category and pattern info)
export async function GET() {
  try {
    const allProblems = db
      .select()
      .from(schema.problems)
      .orderBy(asc(schema.problems.tier), asc(schema.problems.title))
      .all();

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

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Problems fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch problems" },
      { status: 500 }
    );
  }
}

// POST: Create a new problem
export async function POST(request: Request) {
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
      authorId,
    } = body;

    if (!title || !description || !starterCode || !categoryId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    // Link patterns
    if (patternIds && patternIds.length > 0) {
      for (const patternId of patternIds) {
        db.insert(schema.problemPatterns)
          .values({ problemId: id, patternId })
          .onConflictDoNothing()
          .run();
      }
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Problem create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create problem" },
      { status: 500 }
    );
  }
}
