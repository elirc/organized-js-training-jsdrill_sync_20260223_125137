import Database from "better-sqlite3";
import path from "path";
import { DDL, DEFAULT_USER_ID } from "./ddl";
import { itemId, loadContentFiles, moduleId, validateAll } from "./contentFiles";

/**
 * Loads seed-data/content/*.json into the database.
 *
 * Re-runnable: content is upserted under an id derived from the track and
 * module slugs plus the item's position, so editing an explanation or adding a
 * question leaves review schedules untouched. Items that disappear from the
 * content files are deleted, which cascades to their cards — deliberate, but
 * the script reports the count so it can't happen quietly.
 */

const dbPath = process.env.RAMP_DB_PATH ?? path.join(process.cwd(), "ramp.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.exec(DDL);

function seed() {
  const { errors } = validateAll();
  if (errors.length > 0) {
    console.warn(`\n${errors.length} content warning(s) — seeding anyway:`);
    for (const error of errors.slice(0, 20)) console.warn(`  - ${error}`);
    if (errors.length > 20) console.warn(`  … and ${errors.length - 20} more`);
  }

  const files = loadContentFiles();
  const timestamp = new Date().toISOString();
  const seenItemIds = new Set<string>();
  let trackCount = 0;
  let moduleCount = 0;
  let itemCount = 0;

  const upsertTrack = sqlite.prepare(`
    INSERT INTO tracks (id, name, slug, tagline, description, icon, accent, sort_order)
    VALUES (@id, @name, @slug, @tagline, @description, @icon, @accent, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, slug = excluded.slug, tagline = excluded.tagline,
      description = excluded.description, icon = excluded.icon,
      accent = excluded.accent, sort_order = excluded.sort_order
  `);

  const upsertModule = sqlite.prepare(`
    INSERT INTO modules (id, track_id, name, slug, summary, level, key_points, interview_angle, sort_order)
    VALUES (@id, @trackId, @name, @slug, @summary, @level, @keyPoints, @interviewAngle, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      track_id = excluded.track_id, name = excluded.name, slug = excluded.slug,
      summary = excluded.summary, level = excluded.level, key_points = excluded.key_points,
      interview_angle = excluded.interview_angle, sort_order = excluded.sort_order
  `);

  const upsertItem = sqlite.prepare(`
    INSERT INTO items (
      id, module_id, track_id, type, difficulty, frequency, tags, prompt, code, language,
      choices, answer, explanation, follow_up, keywords, model_answer,
      starter_code, solution_code, test_cases, est_seconds, sort_order, is_published,
      created_at, updated_at
    ) VALUES (
      @id, @moduleId, @trackId, @type, @difficulty, @frequency, @tags, @prompt, @code, @language,
      @choices, @answer, @explanation, @followUp, @keywords, @modelAnswer,
      @starterCode, @solutionCode, @testCases, @estSeconds, @sortOrder, 1,
      @now, @now
    )
    ON CONFLICT(id) DO UPDATE SET
      module_id = excluded.module_id, track_id = excluded.track_id, type = excluded.type,
      difficulty = excluded.difficulty, frequency = excluded.frequency, tags = excluded.tags,
      prompt = excluded.prompt, code = excluded.code, language = excluded.language,
      choices = excluded.choices, answer = excluded.answer, explanation = excluded.explanation,
      follow_up = excluded.follow_up, keywords = excluded.keywords,
      model_answer = excluded.model_answer, starter_code = excluded.starter_code,
      solution_code = excluded.solution_code, test_cases = excluded.test_cases,
      est_seconds = excluded.est_seconds, sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const load = sqlite.transaction(() => {
    for (const content of files) {
      const track = content.track;

      upsertTrack.run({
        id: track.id,
        name: track.name,
        slug: track.slug,
        tagline: track.tagline ?? "",
        description: track.description ?? "",
        icon: track.icon ?? "",
        accent: track.accent ?? "slate",
        sortOrder: track.sortOrder ?? 0,
      });
      trackCount++;

      content.modules.forEach((mod, moduleIndex) => {
        const id = moduleId(track.slug, mod.slug);

        upsertModule.run({
          id,
          trackId: track.id,
          name: mod.name,
          slug: mod.slug,
          summary: mod.summary ?? "",
          level: mod.level ?? "foundation",
          keyPoints: JSON.stringify(mod.keyPoints ?? []),
          interviewAngle: mod.interviewAngle ?? "",
          sortOrder: moduleIndex,
        });
        moduleCount++;

        mod.items.forEach((item, index) => {
          const key = item.id ?? itemId(track.slug, mod.slug, index);
          if (seenItemIds.has(key)) return; // already reported by validateAll
          seenItemIds.add(key);

          upsertItem.run({
            id: key,
            moduleId: id,
            trackId: track.id,
            type: item.type,
            difficulty: item.difficulty ?? 1,
            frequency: item.frequency ?? 2,
            tags: JSON.stringify(item.tags ?? []),
            prompt: item.prompt,
            code: item.code ?? "",
            language: item.language ?? "js",
            choices: JSON.stringify(item.choices ?? []),
            answer: JSON.stringify(item.answer ?? null),
            explanation: item.explanation ?? "",
            followUp: item.followUp ?? "",
            keywords: JSON.stringify(item.keywords ?? []),
            modelAnswer: item.modelAnswer ?? "",
            starterCode: item.starterCode ?? "",
            solutionCode: item.solutionCode ?? "",
            testCases: JSON.stringify(item.testCases ?? []),
            estSeconds: item.estSeconds ?? 45,
            sortOrder: index,
            now: timestamp,
          });
          itemCount++;
        });
      });
    }

    // Retire content that's been removed from the files.
    const existing = sqlite.prepare("SELECT id FROM items").all() as { id: string }[];
    const stale = existing.filter((row) => !seenItemIds.has(row.id));
    if (stale.length > 0) {
      const del = sqlite.prepare("DELETE FROM items WHERE id = ?");
      for (const row of stale) del.run(row.id);
      console.log(`Removed ${stale.length} item(s) no longer present in the content files`);
    }
  });

  load();

  sqlite
    .prepare(
      `INSERT OR IGNORE INTO users (id, name, email, daily_goal, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(DEFAULT_USER_ID, "You", "you@ramp.local", 20, "{}", timestamp);

  console.log(
    `\nSeeded ${trackCount} tracks, ${moduleCount} modules, ${itemCount} items → ${dbPath}\n`
  );
  sqlite.close();
}

seed();
