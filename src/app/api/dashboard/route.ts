import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, asc, sql } from "drizzle-orm";

const DEFAULT_USER_ID = "default-user";

export async function GET() {
  try {
    // Category progress
    const tierProgress = db
      .select()
      .from(schema.userTierProgress)
      .where(eq(schema.userTierProgress.userId, DEFAULT_USER_ID))
      .all();

    const categories = db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.sortOrder))
      .all();

    const categoryProgress = categories.map((cat) => {
      const tp = tierProgress.find((t) => t.categoryId === cat.id);
      const totalProblems = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.problems)
        .where(eq(schema.problems.categoryId, cat.id))
        .get();

      const solvedCards = db
        .select()
        .from(schema.userCards)
        .innerJoin(
          schema.problems,
          eq(schema.userCards.problemId, schema.problems.id)
        )
        .where(
          and(
            eq(schema.userCards.userId, DEFAULT_USER_ID),
            eq(schema.problems.categoryId, cat.id)
          )
        )
        .all();

      const avgStability =
        solvedCards.length > 0
          ? solvedCards.reduce((sum, c) => sum + c.user_cards.stability, 0) /
            solvedCards.length
          : 0;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        currentTier: tp?.currentTier || 1,
        totalProblems: totalProblems?.count || 0,
        solvedProblems: solvedCards.length,
        averageStability: Math.round(avgStability * 10) / 10,
      };
    });

    // Activity heat map (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentAttempts = db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.userId, DEFAULT_USER_ID))
      .all();

    const activityMap = new Map<string, number>();
    for (const a of recentAttempts) {
      const date = a.createdAt.split("T")[0];
      activityMap.set(date, (activityMap.get(date) || 0) + 1);
    }
    const activity = Array.from(activityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Pattern strengths
    const allPatterns = db.select().from(schema.patterns).all();
    const patternStrengths = allPatterns.map((pat) => {
      const linkedProblems = db
        .select()
        .from(schema.problemPatterns)
        .where(eq(schema.problemPatterns.patternId, pat.id))
        .all();

      const problemIds = linkedProblems.map((lp) => lp.problemId);

      let solvedCount = 0;
      let totalStability = 0;

      for (const pid of problemIds) {
        const card = db
          .select()
          .from(schema.userCards)
          .where(
            and(
              eq(schema.userCards.userId, DEFAULT_USER_ID),
              eq(schema.userCards.problemId, pid)
            )
          )
          .get();

        if (card && card.reps > 0) {
          solvedCount++;
          totalStability += card.stability;
        }
      }

      const avgStab =
        solvedCount > 0 ? totalStability / solvedCount : 0;

      let strength: "none" | "weak" | "learning" | "strong" = "none";
      if (solvedCount === 0) strength = "none";
      else if (avgStab < 3) strength = "weak";
      else if (avgStab < 10) strength = "learning";
      else strength = "strong";

      return {
        patternId: pat.id,
        patternName: pat.name,
        patternSlug: pat.slug,
        totalProblems: problemIds.length,
        solvedProblems: solvedCount,
        averageStability: Math.round(avgStab * 10) / 10,
        strength,
      };
    });

    // Total stats
    const totalAttempts = recentAttempts.length;
    const passedAttempts = recentAttempts.filter((a) => a.passed).length;

    return NextResponse.json({
      success: true,
      data: {
        categoryProgress,
        activity,
        patternStrengths,
        stats: {
          totalAttempts,
          passedAttempts,
          passRate:
            totalAttempts > 0
              ? Math.round((passedAttempts / totalAttempts) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
