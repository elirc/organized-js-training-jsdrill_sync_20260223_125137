import { NextResponse } from "next/server";
import { sqlite, DEFAULT_USER_ID } from "@/lib/db";
import { generateId, now } from "@/lib/utils";

type Body = {
  trackSlugs?: string[];
  total: number;
  correct: number;
  durationSeconds?: number;
  /** Per-track and per-tag accuracy, for the report card. */
  breakdown?: Record<string, unknown>;
};

/** Stores the result of a completed mock interview run. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const total = Math.max(0, Math.round(body.total ?? 0));
  const correct = Math.max(0, Math.min(total, Math.round(body.correct ?? 0)));
  const id = generateId();

  try {
    sqlite
      .prepare(
        `INSERT INTO interviews
           (id, user_id, track_slugs, total, correct, score, duration_seconds, breakdown, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        DEFAULT_USER_ID,
        JSON.stringify(body.trackSlugs ?? []),
        total,
        correct,
        total === 0 ? 0 : correct / total,
        Math.max(0, Math.round(body.durationSeconds ?? 0)),
        JSON.stringify(body.breakdown ?? {}),
        now()
      );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Failed to save interview:", error);
    return NextResponse.json(
      { success: false, error: "Could not save the interview result" },
      { status: 500 }
    );
  }
}
