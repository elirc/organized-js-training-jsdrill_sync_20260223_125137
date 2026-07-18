import { db, schema } from "@/lib/db";
import { eq, and, lte, isNull, asc, inArray } from "drizzle-orm";
import type { SessionProblem } from "@/types";

const DEFAULT_USER_ID = "default-user";

export async function buildSession(
  sessionSize: number,
  userId: string = DEFAULT_USER_ID
): Promise<SessionProblem[]> {
  const queue: SessionProblem[] = [];
  const now = new Date().toISOString();

  // 1. Get overdue review cards (sorted by most overdue)
  const overdueCards = db
    .select()
    .from(schema.userCards)
    .where(
      and(
        eq(schema.userCards.userId, userId),
        lte(schema.userCards.due, now)
      )
    )
    .orderBy(asc(schema.userCards.due))
    .all();

  const reviewLimit = Math.ceil(sessionSize * 0.6);
  const reviewCardSlice = overdueCards.slice(0, reviewLimit);

  if (reviewCardSlice.length > 0) {
    const reviewProblemIds = reviewCardSlice.map((c) => c.problemId);
    const reviewProblems = db
      .select()
      .from(schema.problems)
      .where(inArray(schema.problems.id, reviewProblemIds))
      .all();

    for (const p of reviewProblems) {
      const sp = await enrichProblem(p, true);
      if (sp) queue.push(sp);
    }
  }

  // 2. Fill remaining with new problems from unlocked tiers
  const remaining = sessionSize - queue.length;
  if (remaining > 0) {
    // Get user's tier progress for each category
    const tierProgress = db
      .select()
      .from(schema.userTierProgress)
      .where(eq(schema.userTierProgress.userId, userId))
      .all();

    const tierMap = new Map<string, number>();
    for (const tp of tierProgress) {
      tierMap.set(tp.categoryId, tp.currentTier);
    }

    // Get problems the user hasn't seen yet (no user_card entry)
    const existingCardProblemIds = db
      .select({ problemId: schema.userCards.problemId })
      .from(schema.userCards)
      .where(eq(schema.userCards.userId, userId))
      .all()
      .map((c) => c.problemId);

    // Get all published system problems
    let allProblems = db
      .select()
      .from(schema.problems)
      .where(
        and(
          eq(schema.problems.isPublished, true),
          isNull(schema.problems.authorId)
        )
      )
      .all();

    // Filter to problems within unlocked tiers and not yet seen
    allProblems = allProblems.filter((p) => {
      const maxTier = tierMap.get(p.categoryId) || 1;
      return p.tier <= maxTier && !existingCardProblemIds.includes(p.id);
    });

    // Sort by tier (lower first) then random within tier
    allProblems.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return Math.random() - 0.5;
    });

    for (const p of allProblems.slice(0, remaining)) {
      const sp = await enrichProblem(p, false);
      if (sp) queue.push(sp);
    }
  }

  // 3. Shuffle to avoid category clustering
  return shuffle(queue);
}

async function enrichProblem(
  p: typeof schema.problems.$inferSelect,
  isReview: boolean
): Promise<SessionProblem | null> {
  // Get category name
  const category = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, p.categoryId))
    .get();

  // Get patterns
  const patternLinks = db
    .select()
    .from(schema.problemPatterns)
    .where(eq(schema.problemPatterns.problemId, p.id))
    .all();

  const patternData =
    patternLinks.length > 0
      ? db
          .select()
          .from(schema.patterns)
          .where(
            inArray(
              schema.patterns.id,
              patternLinks.map((pl) => pl.patternId)
            )
          )
          .all()
      : [];

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    starterCode: p.starterCode,
    testCases: JSON.parse(p.testCases),
    tier: p.tier,
    categoryId: p.categoryId,
    categoryName: category?.name || "Unknown",
    hints: JSON.parse(p.hints),
    timeLimit: p.timeLimit,
    patterns: patternData.map((pat) => ({
      id: pat.id,
      name: pat.name,
      slug: pat.slug,
    })),
    isReview,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
