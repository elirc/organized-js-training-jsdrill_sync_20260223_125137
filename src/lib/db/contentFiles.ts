import fs from "fs";
import path from "path";

/**
 * Loading and validating the authored content files.
 *
 * Shared by the seed script and `npm run content:check`, so a content mistake
 * is caught the same way whether you're loading the database or just linting
 * what you wrote.
 */

export type RawItem = {
  id?: string;
  type: string;
  difficulty?: number;
  frequency?: number;
  tags?: string[];
  prompt: string;
  code?: string;
  language?: string;
  choices?: string[];
  answer?: unknown;
  explanation?: string;
  followUp?: string;
  keywords?: string[];
  modelAnswer?: string;
  starterCode?: string;
  solutionCode?: string;
  testCases?: unknown[];
  estSeconds?: number;
};

export type RawModule = {
  slug: string;
  name: string;
  summary?: string;
  level?: string;
  keyPoints?: string[];
  interviewAngle?: string;
  items: RawItem[];
};

export type ContentFile = {
  file: string;
  track: {
    id: string;
    slug: string;
    name: string;
    tagline?: string;
    description?: string;
    icon?: string;
    accent?: string;
    sortOrder?: number;
  };
  modules: RawModule[];
};

export const VALID_TYPES = new Set([
  "mcq",
  "multi",
  "predict",
  "fill",
  "order",
  "code",
  "explain",
]);

const VALID_LEVELS = new Set(["foundation", "working", "professional"]);

export function contentDir(): string {
  return path.join(process.cwd(), "seed-data", "content");
}

export function loadContentFiles(): ContentFile[] {
  const dir = contentDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`No content directory at ${dir}`);
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      try {
        return { file, ...(JSON.parse(raw) as Omit<ContentFile, "file">) };
      } catch (err) {
        throw new Error(`${file} is not valid JSON: ${(err as Error).message}`);
      }
    });
}

/** Stable id for an item, derived from its position in the content file. */
export function itemId(trackSlug: string, moduleSlug: string, index: number): string {
  return `${trackSlug}-${moduleSlug}-${(index + 1).toString().padStart(2, "0")}`;
}

export function moduleId(trackSlug: string, moduleSlug: string): string {
  return `mod-${trackSlug}-${moduleSlug}`;
}

/**
 * Catches the content mistakes that would otherwise surface as an unanswerable
 * question mid-drill — an answer index pointing past the end of the choices, a
 * fill item whose blanks and answers don't line up, an explain item with no
 * keywords to score against.
 */
export function validateItem(id: string, item: RawItem): string[] {
  const errors: string[] = [];
  const choices = item.choices ?? [];

  if (!VALID_TYPES.has(item.type)) {
    return [`${id}: unknown type "${item.type}"`];
  }
  if (!item.prompt?.trim()) errors.push(`${id}: empty prompt`);
  if (!item.explanation?.trim()) errors.push(`${id}: no explanation — the learner gets no feedback`);
  if (item.difficulty !== undefined && ![1, 2, 3].includes(item.difficulty)) {
    errors.push(`${id}: difficulty must be 1, 2 or 3`);
  }
  if (item.frequency !== undefined && ![1, 2, 3].includes(item.frequency)) {
    errors.push(`${id}: frequency must be 1, 2 or 3`);
  }

  switch (item.type) {
    case "mcq": {
      if (choices.length < 2) errors.push(`${id}: mcq needs at least 2 choices`);
      if (
        typeof item.answer !== "number" ||
        item.answer < 0 ||
        item.answer >= choices.length
      ) {
        errors.push(`${id}: mcq answer must be a choice index (got ${JSON.stringify(item.answer)})`);
      }
      break;
    }
    case "multi": {
      if (choices.length < 2) errors.push(`${id}: multi needs at least 2 choices`);
      if (!Array.isArray(item.answer) || item.answer.length === 0) {
        errors.push(`${id}: multi answer must be a non-empty array of indices`);
      } else if (
        item.answer.some((i) => typeof i !== "number" || i < 0 || i >= choices.length)
      ) {
        errors.push(`${id}: multi answer has an out-of-range index`);
      }
      break;
    }
    case "order": {
      if (!Array.isArray(item.answer) || item.answer.length !== choices.length) {
        errors.push(`${id}: order answer must list every choice exactly once`);
      } else if (new Set(item.answer).size !== choices.length) {
        errors.push(`${id}: order answer has duplicate or missing positions`);
      }
      break;
    }
    case "fill": {
      if (!Array.isArray(item.answer) || item.answer.length === 0) {
        errors.push(`${id}: fill answer must be an array of blank values`);
      } else {
        const blanks = (item.code ?? "").match(/_{2,}/g)?.length ?? 0;
        if (blanks !== item.answer.length) {
          errors.push(`${id}: ${blanks} blank(s) in the code but ${item.answer.length} answer(s)`);
        }
      }
      break;
    }
    case "predict": {
      if (typeof item.answer !== "string" || !item.answer.trim()) {
        errors.push(`${id}: predict answer must be a non-empty string`);
      }
      break;
    }
    case "explain": {
      if (!item.keywords?.length) errors.push(`${id}: explain needs keywords to score against`);
      if (!item.modelAnswer?.trim()) errors.push(`${id}: explain needs a model answer`);
      break;
    }
    case "code": {
      if (!item.starterCode?.trim()) errors.push(`${id}: code item needs starterCode`);
      if (!item.testCases?.length) {
        errors.push(`${id}: code item needs test cases`);
      } else {
        item.testCases.forEach((raw, i) => {
          const test = raw as { input?: unknown; call?: unknown; description?: unknown };
          if (!Array.isArray(test.input) && typeof test.call !== "string") {
            errors.push(`${id}: test ${i + 1} has neither an input array nor a call driver`);
          }
          if (typeof test.description !== "string" || !test.description.trim()) {
            errors.push(`${id}: test ${i + 1} has no description`);
          }
        });
      }
      break;
    }
  }

  return errors;
}

export function validateModule(mod: RawModule, file: string): string[] {
  const errors: string[] = [];
  if (!mod.slug?.trim()) errors.push(`${file}: a module has no slug`);
  if (!mod.name?.trim()) errors.push(`${file}/${mod.slug}: no name`);
  if (mod.level && !VALID_LEVELS.has(mod.level)) {
    errors.push(`${file}/${mod.slug}: unknown level "${mod.level}"`);
  }
  if (!mod.items?.length) errors.push(`${file}/${mod.slug}: no items`);
  return errors;
}

/** Full corpus check. Returns every problem found, plus a summary. */
export function validateAll(): {
  errors: string[];
  tracks: number;
  modules: number;
  items: number;
  byType: Record<string, number>;
} {
  const files = loadContentFiles();
  const errors: string[] = [];
  const seenItemIds = new Set<string>();
  const seenTrackSlugs = new Set<string>();
  const byType: Record<string, number> = {};
  let modules = 0;
  let items = 0;

  for (const content of files) {
    if (seenTrackSlugs.has(content.track.slug)) {
      errors.push(`${content.file}: duplicate track slug "${content.track.slug}"`);
    }
    seenTrackSlugs.add(content.track.slug);

    const seenModuleSlugs = new Set<string>();

    for (const mod of content.modules) {
      errors.push(...validateModule(mod, content.file));
      if (seenModuleSlugs.has(mod.slug)) {
        errors.push(`${content.file}: duplicate module slug "${mod.slug}"`);
      }
      seenModuleSlugs.add(mod.slug);
      modules++;

      mod.items.forEach((item, index) => {
        const id = item.id ?? itemId(content.track.slug, mod.slug, index);
        if (seenItemIds.has(id)) errors.push(`duplicate item id "${id}" (${content.file})`);
        seenItemIds.add(id);
        errors.push(...validateItem(id, item));
        byType[item.type] = (byType[item.type] ?? 0) + 1;
        items++;
      });
    }
  }

  return { errors, tracks: files.length, modules, items, byType };
}
