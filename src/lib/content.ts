import { sqlite } from "@/lib/db";
import { safeJson } from "@/lib/utils";
import type { DrillItem, Item, ItemType, Language, Level, Module, TestCase, Track } from "@/types";

/**
 * Read-side access to the content corpus.
 *
 * Content is joined and shaped here rather than in route handlers so the drill
 * runner, the library browser and the interview mode all get identically-shaped
 * items.
 */

type ItemRow = {
  id: string;
  module_id: string;
  track_id: string;
  type: string;
  difficulty: number;
  frequency: number;
  tags: string;
  prompt: string;
  code: string;
  language: string;
  choices: string;
  answer: string;
  explanation: string;
  follow_up: string;
  keywords: string;
  model_answer: string;
  starter_code: string;
  solution_code: string;
  test_cases: string;
  est_seconds: number;
  sort_order: number;
};

type DrillRow = ItemRow & {
  track_name: string;
  track_slug: string;
  track_accent: string;
  module_name: string;
  module_slug: string;
  due: string | null;
  reps: number | null;
};

const ITEM_COLUMNS = `
  i.id, i.module_id, i.track_id, i.type, i.difficulty, i.frequency, i.tags,
  i.prompt, i.code, i.language, i.choices, i.answer, i.explanation, i.follow_up,
  i.keywords, i.model_answer, i.starter_code, i.solution_code, i.test_cases,
  i.est_seconds, i.sort_order
`;

const DRILL_SELECT = `
  SELECT ${ITEM_COLUMNS},
         t.name AS track_name, t.slug AS track_slug, t.accent AS track_accent,
         m.name AS module_name, m.slug AS module_slug,
         c.due AS due, c.reps AS reps
  FROM items i
  JOIN modules m ON m.id = i.module_id
  JOIN tracks t ON t.id = i.track_id
  LEFT JOIN user_cards c ON c.item_id = i.id AND c.user_id = ?
  WHERE i.is_published = 1
`;

export function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    moduleId: row.module_id,
    trackId: row.track_id,
    type: row.type as ItemType,
    difficulty: row.difficulty as 1 | 2 | 3,
    frequency: row.frequency as 1 | 2 | 3,
    tags: safeJson<string[]>(row.tags, []),
    prompt: row.prompt,
    code: row.code,
    language: row.language as Language,
    choices: safeJson<string[]>(row.choices, []),
    answer: safeJson<unknown>(row.answer, null),
    explanation: row.explanation,
    followUp: row.follow_up,
    keywords: safeJson<string[]>(row.keywords, []),
    modelAnswer: row.model_answer,
    starterCode: row.starter_code,
    solutionCode: row.solution_code,
    testCases: safeJson<TestCase[]>(row.test_cases, []),
    estSeconds: row.est_seconds,
    sortOrder: row.sort_order,
  };
}

export function mapDrillItem(row: DrillRow, isReview: boolean): DrillItem {
  return {
    ...mapItem(row),
    trackName: row.track_name,
    trackSlug: row.track_slug,
    trackAccent: row.track_accent,
    moduleName: row.module_name,
    moduleSlug: row.module_slug,
    isReview,
    due: row.due,
    reps: row.reps ?? 0,
  };
}

export function getTracks(): Track[] {
  const rows = sqlite
    .prepare(`SELECT * FROM tracks ORDER BY sort_order, name`)
    .all() as Record<string, never>[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    tagline: r.tagline,
    description: r.description,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
  }));
}

export function getTrackBySlug(slug: string): Track | null {
  return getTracks().find((t) => t.slug === slug) ?? null;
}

export function getModules(trackId?: string): Module[] {
  const rows = (
    trackId
      ? sqlite
          .prepare(`SELECT * FROM modules WHERE track_id = ? ORDER BY sort_order`)
          .all(trackId)
      : sqlite
          .prepare(
            `SELECT m.* FROM modules m
             JOIN tracks t ON t.id = m.track_id
             ORDER BY t.sort_order, m.sort_order`
          )
          .all()
  ) as Record<string, never>[];

  return rows.map((r) => ({
    id: r.id,
    trackId: r.track_id,
    name: r.name,
    slug: r.slug,
    summary: r.summary,
    level: r.level as Level,
    keyPoints: safeJson<string[]>(r.key_points, []),
    interviewAngle: r.interview_angle,
    sortOrder: r.sort_order,
  }));
}

export function getModuleBySlug(trackSlug: string, moduleSlug: string): Module | null {
  const row = sqlite
    .prepare(
      `SELECT m.* FROM modules m
       JOIN tracks t ON t.id = m.track_id
       WHERE t.slug = ? AND m.slug = ?`
    )
    .get(trackSlug, moduleSlug) as Record<string, never> | undefined;

  if (!row) return null;
  return {
    id: row.id,
    trackId: row.track_id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    level: row.level as Level,
    keyPoints: safeJson<string[]>(row.key_points, []),
    interviewAngle: row.interview_angle,
    sortOrder: row.sort_order,
  };
}

/** Drill items for one module, in author order. */
export function getModuleItems(userId: string, moduleId: string): DrillItem[] {
  const rows = sqlite
    .prepare(`${DRILL_SELECT} AND i.module_id = ? ORDER BY i.sort_order`)
    .all(userId, moduleId) as DrillRow[];
  return rows.map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
}

export function getDrillItem(userId: string, itemId: string): DrillItem | null {
  const row = sqlite.prepare(`${DRILL_SELECT} AND i.id = ?`).get(userId, itemId) as
    | DrillRow
    | undefined;
  return row ? mapDrillItem(row, (row.reps ?? 0) > 0) : null;
}

export type LibraryFilters = {
  trackSlug?: string;
  moduleSlug?: string;
  type?: string;
  search?: string;
  savedOnly?: boolean;
  limit?: number;
};

/** Browsable list for the library page. */
export function searchItems(userId: string, filters: LibraryFilters): DrillItem[] {
  const clauses: string[] = [];
  const params: unknown[] = [userId];

  if (filters.trackSlug) {
    clauses.push("t.slug = ?");
    params.push(filters.trackSlug);
  }
  if (filters.moduleSlug) {
    clauses.push("m.slug = ?");
    params.push(filters.moduleSlug);
  }
  if (filters.type) {
    clauses.push("i.type = ?");
    params.push(filters.type);
  }
  if (filters.search) {
    // Match the question, the snippet and the tags — tags are stored as a JSON
    // array, so a LIKE over the raw text is the cheap way to search them.
    clauses.push("(i.prompt LIKE ? OR i.code LIKE ? OR i.tags LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }
  if (filters.savedOnly) {
    clauses.push("EXISTS (SELECT 1 FROM saved_items s WHERE s.item_id = i.id AND s.user_id = ?)");
    params.push(userId);
  }

  const where = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 60, 200);

  const rows = sqlite
    .prepare(
      `${DRILL_SELECT}${where}
       ORDER BY t.sort_order, m.sort_order, i.sort_order
       LIMIT ${limit}`
    )
    .all(...params) as DrillRow[];

  return rows.map((r) => mapDrillItem(r, (r.reps ?? 0) > 0));
}

export function getSavedItemIds(userId: string): Set<string> {
  const rows = sqlite
    .prepare(`SELECT item_id FROM saved_items WHERE user_id = ?`)
    .all(userId) as { item_id: string }[];
  return new Set(rows.map((r) => r.item_id));
}

export { DRILL_SELECT };
export type { DrillRow };
