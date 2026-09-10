import { sqlite } from "@/lib/db";
import { DRILL_SELECT, mapDrillItem, type DrillRow } from "@/lib/content";
import { getNextModule, getWeakSpots } from "@/lib/progress";
import { shuffle } from "@/lib/utils";
import type { DrillItem, DrillSession, SessionMode } from "@/types";

export type SessionRequest = {
  userId: string;
  mode: SessionMode;
  size: number;
  moduleSlug?: string;
  trackSlug?: string;
};

/**
 * Builds the queue for one drill.
 *
 * The shape of a mixed session is deliberately review-first: anything due goes
 * in before new material, because the whole point of spaced repetition is that
 * a lapsed item is worth more than a fresh one. New items are then drawn from
 * the earliest unmastered module so the learner walks the roadmap rather than
 * bouncing randomly across seven tracks.
 */
export function buildSession(request: SessionRequest): DrillSession {
  const size = Math.max(1, Math.min(request.size, 40));

  switch (request.mode) {
    case "module":
      return moduleSession(request, size);
    case "track":
      return trackSession(request, size);
    case "weak":
      return weakSession(request, size);
    case "interview":
      return interviewSession(request, size);
    case "mixed":
    default:
      return mixedSession(request, size);
  }
}

// ─── mixed: due reviews, then new items along the roadmap ───

function mixedSession(request: SessionRequest, size: number): DrillSession {
  const { userId } = request;
  const due = fetchDue(userId, size);

  // Leave at least a third of the session for new material unless there's a
  // genuine backlog — otherwise a few bad days turn the app into pure review
  // and progress stalls.
  const reviewCap = due.length > size ? size : Math.max(Math.ceil(size * 0.6), size - 6);
  const reviews = due.slice(0, Math.min(reviewCap, size));

  const remaining = size - reviews.length;
  const fresh = remaining > 0 ? fetchNewAlongRoadmap(userId, remaining) : [];

  return {
    items: interleave(reviews, fresh),
    meta: {
      mode: "mixed",
      reviewCount: reviews.length,
      newCount: fresh.length,
      label:
        fresh.length === 0
          ? "Review session"
          : reviews.length === 0
            ? "New material"
            : `${reviews.length} review, ${fresh.length} new`,
    },
  };
}

// ─── module: everything in one module, due items first ───

function moduleSession(request: SessionRequest, size: number): DrillSession {
  const { userId, trackSlug, moduleSlug } = request;
  const rows = sqlite
    .prepare(
      `${DRILL_SELECT}
       AND m.slug = ? ${trackSlug ? "AND t.slug = ?" : ""}
       ORDER BY
         CASE WHEN c.due IS NULL THEN 1 ELSE 0 END,
         c.due ASC,
         i.sort_order`
    )
    .all(...[userId, moduleSlug, ...(trackSlug ? [trackSlug] : [])]) as DrillRow[];

  const items = rows.slice(0, size).map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
  return {
    items,
    meta: {
      mode: "module",
      reviewCount: items.filter((i) => i.isReview).length,
      newCount: items.filter((i) => !i.isReview).length,
      label: items[0]?.moduleName ?? "Module drill",
    },
  };
}

// ─── track: due first, then unseen, across one track ───

function trackSession(request: SessionRequest, size: number): DrillSession {
  const { userId, trackSlug } = request;
  const rows = sqlite
    .prepare(
      `${DRILL_SELECT} AND t.slug = ?
       ORDER BY
         CASE
           WHEN c.due IS NOT NULL AND c.due <= ? THEN 0
           WHEN c.due IS NULL THEN 1
           ELSE 2
         END,
         m.sort_order, i.sort_order`
    )
    .all(userId, trackSlug, isoNow()) as DrillRow[];

  const items = rows.slice(0, size).map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
  return {
    items,
    meta: {
      mode: "track",
      reviewCount: items.filter((i) => i.isReview).length,
      newCount: items.filter((i) => !i.isReview).length,
      label: items[0]?.trackName ?? "Track drill",
    },
  };
}

// ─── weak: target the tags you keep getting wrong ───

function weakSession(request: SessionRequest, size: number): DrillSession {
  const { userId } = request;
  const weak = getWeakSpots(userId, 6);

  if (weak.length === 0) {
    // Nothing has enough attempts to call a weakness yet — a normal mixed
    // session is more useful than an empty screen.
    const fallback = mixedSession(request, size);
    return {
      ...fallback,
      meta: { ...fallback.meta, mode: "weak", label: "Not enough history yet — mixed practice" },
    };
  }

  const conditions = weak.map(() => "i.tags LIKE ?").join(" OR ");
  const params = weak.map((w) => `%"${w.tag}"%`);

  const rows = sqlite
    .prepare(`${DRILL_SELECT} AND (${conditions}) ORDER BY RANDOM() LIMIT ${size}`)
    .all(userId, ...params) as DrillRow[];

  const items = rows.map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
  return {
    items,
    meta: {
      mode: "weak",
      reviewCount: items.filter((i) => i.isReview).length,
      newCount: items.filter((i) => !i.isReview).length,
      label: `Weak spots: ${weak.slice(0, 3).map((w) => w.tag).join(", ")}`,
    },
  };
}

// ─── interview: high-frequency questions, weighted to what gets asked ───

function interviewSession(request: SessionRequest, size: number): DrillSession {
  const { userId, trackSlug } = request;
  const slugs = trackSlug ? trackSlug.split(",").filter(Boolean) : [];

  const trackClause = slugs.length
    ? `AND t.slug IN (${slugs.map(() => "?").join(",")})`
    : "";

  // Weighted random: frequency 3 items are three times as likely to appear as
  // frequency 1, which is roughly how a real screen is distributed. Explain
  // items are excluded — self-grading mid-interview defeats the timing.
  const rows = sqlite
    .prepare(
      `${DRILL_SELECT} ${trackClause}
       AND i.type != 'explain'
       ORDER BY (ABS(RANDOM()) % 1000) / CAST(i.frequency AS REAL)
       LIMIT ${size}`
    )
    .all(userId, ...slugs) as DrillRow[];

  const items = rows.map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
  return {
    items,
    meta: {
      mode: "interview",
      reviewCount: 0,
      newCount: items.length,
      label: slugs.length ? `Mock interview: ${slugs.join(", ")}` : "Mock interview: all tracks",
    },
  };
}

// ─── helpers ───

function fetchDue(userId: string, limit: number): DrillItem[] {
  const rows = sqlite
    .prepare(
      `${DRILL_SELECT}
       AND c.due IS NOT NULL AND c.due <= ?
       ORDER BY c.due ASC
       LIMIT ${limit}`
    )
    .all(userId, isoNow()) as DrillRow[];
  return rows.map((r) => mapDrillItem(r, true));
}

/**
 * Due dates are stored as JavaScript ISO strings ("...T03:46:41.655Z") and
 * compared as text. SQLite's own datetime('now') formats with a space instead
 * of the T, which sorts *below* every ISO string — so comparing against it
 * silently matches nothing. Always bind the timestamp from here.
 */
function isoNow(): string {
  return new Date().toISOString();
}

/**
 * New items come from the current module first, then spill into the next ones,
 * so a session teaches a coherent topic instead of one question from each of
 * twelve unrelated areas.
 */
function fetchNewAlongRoadmap(userId: string, limit: number): DrillItem[] {
  const next = getNextModule(userId);

  const rows = sqlite
    .prepare(
      `${DRILL_SELECT}
       AND c.item_id IS NULL
       ORDER BY
         CASE WHEN i.module_id = ? THEN 0 ELSE 1 END,
         t.sort_order, m.sort_order, i.sort_order
       LIMIT ${limit}`
    )
    .all(userId, next?.moduleId ?? "") as DrillRow[];

  return rows.map((r) => mapDrillItem(r, false));
}

/**
 * Mix the two groups so neither forms a long run: a block of unfamiliar
 * questions is where people give up, and a block of easy reviews is where they
 * stop paying attention. Whichever group is smaller gets distributed evenly
 * through the larger one.
 */
function interleave(reviews: DrillItem[], fresh: DrillItem[]): DrillItem[] {
  if (reviews.length === 0) return shuffle(fresh);
  if (fresh.length === 0) return shuffle(reviews);

  const [base, sprinkle] =
    reviews.length >= fresh.length
      ? [shuffle(reviews), shuffle(fresh)]
      : [shuffle(fresh), shuffle(reviews)];

  const result = [...base];
  const gap = (result.length + 1) / (sprinkle.length + 1);

  // Insert from the back so earlier insertions don't shift later positions.
  for (let i = sprinkle.length - 1; i >= 0; i--) {
    const position = Math.min(result.length, Math.round((i + 1) * gap));
    result.splice(position, 0, sprinkle[i]);
  }

  return result;
}
