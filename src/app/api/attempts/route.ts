import { NextResponse } from "next/server";
import { sqlite, DEFAULT_USER_ID } from "@/lib/db";
import { getDrillItem } from "@/lib/content";
import { grade, ratingFor } from "@/lib/grading";
import { cardFromRow, cardToRow, newCard, review, type CardRow } from "@/lib/fsrs";
import { generateId, now } from "@/lib/utils";
import type { Rating, Response as DrillResponse, Verdict } from "@/types";

type Body = {
  itemId: string;
  response: DrillResponse;
  timeSpent?: number;
  usedHint?: boolean;
  interviewId?: string;
  /** Only trusted for types the server can't grade itself. */
  verdict?: Verdict;
  score?: number;
};

/**
 * Records one answered item and advances its review schedule.
 *
 * The grade is recomputed here rather than trusted from the client, so the
 * progress numbers reflect the same rules everywhere. The two exceptions are
 * `code` (graded by the browser sandbox) and `explain` (the learner rates
 * themselves) — for those the client's verdict is the only one available.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.itemId || !body.response) {
    return NextResponse.json(
      { success: false, error: "itemId and response are required" },
      { status: 400 }
    );
  }

  const item = getDrillItem(DEFAULT_USER_ID, body.itemId);
  if (!item) {
    return NextResponse.json({ success: false, error: "Unknown item" }, { status: 404 });
  }

  const clientGraded = item.type === "code" || item.type === "explain";
  const verdict: Verdict = clientGraded
    ? (body.verdict ?? "incorrect")
    : grade(item, body.response).verdict;
  const score = clientGraded
    ? clamp(body.score ?? 0)
    : grade(item, body.response).score;

  const timeSpent = Math.max(0, Math.round(body.timeSpent ?? 0));
  const usedHint = Boolean(body.usedHint);

  const rating: Rating =
    body.response.kind === "selfRated"
      ? body.response.rating
      : ratingFor(
          { verdict, score, detail: [], hits: [], misses: [], tests: [], message: "" },
          timeSpent,
          item.estSeconds,
          usedHint
        );

  const timestamp = now();

  try {
    const persist = sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO attempts
             (id, user_id, item_id, response, verdict, score, rating, time_spent, used_hint, interview_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          generateId(),
          DEFAULT_USER_ID,
          item.id,
          JSON.stringify(body.response),
          verdict,
          score,
          rating,
          timeSpent,
          usedHint ? 1 : 0,
          body.interviewId ?? null,
          timestamp
        );

      const existing = sqlite
        .prepare(
          `SELECT id, stability, difficulty, due, reps, lapses, state, last_review AS lastReview
           FROM user_cards WHERE user_id = ? AND item_id = ?`
        )
        .get(DEFAULT_USER_ID, item.id) as (CardRow & { id: string }) | undefined;

      const current = existing ? cardFromRow(existing) : newCard();
      const updated = cardToRow(review(current, rating));

      if (existing) {
        sqlite
          .prepare(
            `UPDATE user_cards
             SET stability = ?, difficulty = ?, due = ?, reps = ?, lapses = ?, state = ?, last_review = ?
             WHERE id = ?`
          )
          .run(
            updated.stability,
            updated.difficulty,
            updated.due,
            updated.reps,
            updated.lapses,
            updated.state,
            updated.lastReview,
            existing.id
          );
      } else {
        sqlite
          .prepare(
            `INSERT INTO user_cards
               (id, user_id, item_id, stability, difficulty, due, reps, lapses, state, last_review)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            generateId(),
            DEFAULT_USER_ID,
            item.id,
            updated.stability,
            updated.difficulty,
            updated.due,
            updated.reps,
            updated.lapses,
            updated.state,
            updated.lastReview
          );
      }

      return updated;
    });

    const card = persist();

    return NextResponse.json({
      success: true,
      data: { verdict, score, rating, nextDue: card.due },
    });
  } catch (error) {
    console.error("Failed to record attempt:", error);
    return NextResponse.json(
      { success: false, error: "Could not record the attempt" },
      { status: 500 }
    );
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
