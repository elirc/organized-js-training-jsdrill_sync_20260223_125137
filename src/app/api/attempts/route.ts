import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateId, now } from "@/lib/utils";
import { createNewCard, scheduleNext, cardFromDb, cardToDb } from "@/lib/fsrs";

const DEFAULT_USER_ID = "default-user";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      problemId,
      code,
      approachText,
      passed,
      timeSpent,
      timedMode,
      errorType,
    } = body;

    if (!problemId || code === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const timestamp = now();

    // 1. Record the attempt
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

    // 2. Get or create the FSRS card for this user×problem
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

    // Get problem for time limit
    const problem = db
      .select()
      .from(schema.problems)
      .where(eq(schema.problems.id, problemId))
      .get();

    const timeLimit = problem?.timeLimit || 300;

    if (!existingCard) {
      // Create new card
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

    // 3. Schedule next review via FSRS
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

    // 4. Update tier progress if passed
    if (passed && problem) {
      updateTierProgress(problem.categoryId);
    }

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        rating,
        nextDue: updatedCardData.due,
      },
    });
  } catch (error) {
    console.error("Attempt recording error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record attempt" },
      { status: 500 }
    );
  }
}

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

  // Promote if 4 consecutive passes at current tier
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
