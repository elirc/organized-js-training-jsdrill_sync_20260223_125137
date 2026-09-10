import { sqlite } from "@/lib/db";
import { cardMastery } from "@/lib/fsrs";
import { computeStreak, daysAgo, localDay, safeJson } from "@/lib/utils";
import { getModules, getTracks } from "@/lib/content";
import type {
  DashboardData,
  DayActivity,
  InterviewSummary,
  Level,
  ModuleProgress,
  TrackProgress,
  WeakSpot,
} from "@/types";

type CardStat = {
  item_id: string;
  module_id: string;
  track_id: string;
  stability: number;
  reps: number;
  state: number;
  due: string;
};

/**
 * Mastery is retention-weighted rather than a raw "answered correctly once"
 * count: an item you got right three months ago and never revisited should not
 * keep a module looking green.
 */
export function getTrackProgress(userId: string): TrackProgress[] {
  const tracks = getTracks();
  const modules = getModules();

  const itemCounts = sqlite
    .prepare(
      `SELECT module_id, COUNT(*) AS total FROM items WHERE is_published = 1 GROUP BY module_id`
    )
    .all() as { module_id: string; total: number }[];
  const totalByModule = new Map(itemCounts.map((r) => [r.module_id, r.total]));

  const cards = sqlite
    .prepare(
      `SELECT c.item_id, i.module_id, i.track_id, c.stability, c.reps, c.state, c.due
       FROM user_cards c
       JOIN items i ON i.id = c.item_id
       WHERE c.user_id = ? AND i.is_published = 1`
    )
    .all(userId) as CardStat[];

  const byModule = new Map<string, CardStat[]>();
  for (const card of cards) {
    const list = byModule.get(card.module_id);
    if (list) list.push(card);
    else byModule.set(card.module_id, [card]);
  }

  const nowIso = new Date().toISOString();

  const moduleProgress: ModuleProgress[] = modules.map((mod) => {
    const total = totalByModule.get(mod.id) ?? 0;
    const modCards = byModule.get(mod.id) ?? [];
    const seen = modCards.filter((c) => c.reps > 0).length;
    const dueItems = modCards.filter((c) => c.reps > 0 && c.due <= nowIso).length;

    // Unseen items count as zero mastery, so a module only reaches 100% when
    // every question in it is genuinely retained.
    const masterySum = modCards.reduce((sum, c) => sum + cardMastery(c), 0);
    const mastery = total === 0 ? 0 : Math.min(1, masterySum / total);

    return {
      moduleId: mod.id,
      moduleName: mod.name,
      moduleSlug: mod.slug,
      trackId: mod.trackId,
      trackSlug: tracks.find((t) => t.id === mod.trackId)?.slug ?? "",
      level: mod.level as Level,
      sortOrder: mod.sortOrder,
      totalItems: total,
      seenItems: seen,
      mastery,
      dueItems,
      status: statusFor(seen, mastery),
    };
  });

  return tracks.map((track) => {
    const mods = moduleProgress.filter((m) => m.trackId === track.id);
    const totalItems = mods.reduce((s, m) => s + m.totalItems, 0);
    const seenItems = mods.reduce((s, m) => s + m.seenItems, 0);
    const dueItems = mods.reduce((s, m) => s + m.dueItems, 0);
    // Weight by item count so a 4-item module doesn't swing the track average
    // as much as a 12-item one.
    const mastery =
      totalItems === 0
        ? 0
        : mods.reduce((s, m) => s + m.mastery * m.totalItems, 0) / totalItems;

    return {
      trackId: track.id,
      trackName: track.name,
      trackSlug: track.slug,
      icon: track.icon,
      accent: track.accent,
      tagline: track.tagline,
      totalItems,
      seenItems,
      mastery,
      dueItems,
      modules: mods,
    };
  });
}

function statusFor(seen: number, mastery: number): ModuleProgress["status"] {
  if (seen === 0) return "available";
  if (mastery >= 0.85) return "mastered";
  return "in-progress";
}

/**
 * The next module to work on: the earliest one along the roadmap that isn't
 * mastered. Nothing is hard-locked — this is a recommendation, and the library
 * stays open — but it gives the "what now?" button something sensible to do.
 */
export function getNextModule(userId: string): ModuleProgress | null {
  const tracks = getTrackProgress(userId);
  const ordered = tracks.flatMap((t) => t.modules);
  return ordered.find((m) => m.status !== "mastered") ?? null;
}

export function getActivity(userId: string, days = 120): DayActivity[] {
  const since = daysAgo(days);
  const rows = sqlite
    .prepare(
      `SELECT created_at, verdict FROM attempts
       WHERE user_id = ? AND created_at >= ?`
    )
    .all(userId, since) as { created_at: string; verdict: string }[];

  const map = new Map<string, DayActivity>();
  for (const row of rows) {
    const day = localDay(row.created_at);
    const entry = map.get(day) ?? { date: day, count: 0, correct: 0 };
    entry.count++;
    if (row.verdict === "correct") entry.correct++;
    map.set(day, entry);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Tags you get wrong most often, which is a far more actionable view than
 * per-module accuracy — "you're shaky on closures" beats "72% on module 2".
 */
export function getWeakSpots(userId: string, limit = 8): WeakSpot[] {
  const rows = sqlite
    .prepare(
      `SELECT i.tags, i.track_id, a.verdict
       FROM attempts a
       JOIN items i ON i.id = a.item_id
       WHERE a.user_id = ?`
    )
    .all(userId) as { tags: string; track_id: string; verdict: string }[];

  const tracks = getTracks();
  const stats = new Map<string, { attempts: number; correct: number; trackId: string }>();

  for (const row of rows) {
    for (const tag of safeJson<string[]>(row.tags, [])) {
      const entry = stats.get(tag) ?? { attempts: 0, correct: 0, trackId: row.track_id };
      entry.attempts++;
      if (row.verdict === "correct") entry.correct++;
      stats.set(tag, entry);
    }
  }

  return [...stats.entries()]
    // Below three attempts an accuracy figure is noise, not a weakness.
    .filter(([, s]) => s.attempts >= 3)
    .map(([tag, s]) => {
      const track = tracks.find((t) => t.id === s.trackId);
      return {
        tag,
        attempts: s.attempts,
        correct: s.correct,
        accuracy: s.correct / s.attempts,
        trackSlug: track?.slug ?? "",
        trackName: track?.name ?? "",
      };
    })
    .filter((w) => w.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, limit);
}

export function getDashboard(userId: string): DashboardData {
  const tracks = getTrackProgress(userId);
  const activity = getActivity(userId);
  const weakSpots = getWeakSpots(userId);

  const totals = sqlite
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN verdict = 'correct' THEN 1 ELSE 0 END) AS correct,
              COALESCE(SUM(time_spent), 0) AS seconds
       FROM attempts WHERE user_id = ?`
    )
    .get(userId) as { total: number; correct: number | null; seconds: number };

  const itemsTotal = tracks.reduce((s, t) => s + t.totalItems, 0);
  const itemsSeen = tracks.reduce((s, t) => s + t.seenItems, 0);
  const dueToday = tracks.reduce((s, t) => s + t.dueItems, 0);
  const readiness =
    itemsTotal === 0
      ? 0
      : tracks.reduce((s, t) => s + t.mastery * t.totalItems, 0) / itemsTotal;

  const interviews = sqlite
    .prepare(
      `SELECT id, created_at, track_slugs, total, correct, score, duration_seconds
       FROM interviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`
    )
    .all(userId) as {
    id: string;
    created_at: string;
    track_slugs: string;
    total: number;
    correct: number;
    score: number;
    duration_seconds: number;
  }[];

  const recentInterviews: InterviewSummary[] = interviews.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    trackSlugs: safeJson<string[]>(row.track_slugs, []),
    total: row.total,
    correct: row.correct,
    score: row.score,
    durationSeconds: row.duration_seconds,
  }));

  return {
    tracks,
    activity,
    weakSpots,
    recentInterviews,
    stats: {
      totalAttempts: totals.total,
      correctAttempts: totals.correct ?? 0,
      accuracy: totals.total === 0 ? 0 : (totals.correct ?? 0) / totals.total,
      itemsSeen,
      itemsTotal,
      dueToday,
      streak: computeStreak(new Set(activity.filter((a) => a.count > 0).map((a) => a.date))),
      minutesPracticed: Math.round(totals.seconds / 60),
      readiness,
    },
  };
}
