import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    const all = db
      .select()
      .from(schema.patterns)
      .orderBy(asc(schema.patterns.name))
      .all();

    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    console.error("Patterns fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patterns" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, description, explanation } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const id = generateId();
    db.insert(schema.patterns)
      .values({
        id,
        name,
        slug,
        description: description || "",
        explanation: explanation || "",
      })
      .run();

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Pattern create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create pattern" },
      { status: 500 }
    );
  }
}
