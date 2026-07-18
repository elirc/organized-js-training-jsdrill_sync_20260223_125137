import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    const all = db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.sortOrder))
      .all();

    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, icon, sortOrder } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const id = generateId();
    db.insert(schema.categories)
      .values({
        id,
        name,
        description: description || "",
        icon: icon || "",
        sortOrder: sortOrder || 0,
      })
      .run();

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Category create error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    );
  }
}
