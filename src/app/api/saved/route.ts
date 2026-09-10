import { NextResponse } from "next/server";
import { sqlite, DEFAULT_USER_ID } from "@/lib/db";
import { generateId, now } from "@/lib/utils";

/** Toggle a bookmark on an item, so it can be revisited from the library. */
export async function POST(request: Request) {
  let body: { itemId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.itemId) {
    return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
  }

  try {
    const existing = sqlite
      .prepare(`SELECT id FROM saved_items WHERE user_id = ? AND item_id = ?`)
      .get(DEFAULT_USER_ID, body.itemId) as { id: string } | undefined;

    if (existing) {
      sqlite.prepare(`DELETE FROM saved_items WHERE id = ?`).run(existing.id);
      return NextResponse.json({ success: true, data: { saved: false } });
    }

    sqlite
      .prepare(
        `INSERT INTO saved_items (id, user_id, item_id, note, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(generateId(), DEFAULT_USER_ID, body.itemId, body.note ?? "", now());

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error("Failed to toggle saved item:", error);
    return NextResponse.json(
      { success: false, error: "Could not update your saved items" },
      { status: 500 }
    );
  }
}
