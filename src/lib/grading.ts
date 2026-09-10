import type { DrillItem, Grade, Item, Rating, Response, Verdict } from "@/types";
import { deepEqual } from "./utils";

const EMPTY: Omit<Grade, "verdict" | "score" | "message"> = {
  detail: [],
  hits: [],
  misses: [],
  tests: [],
};

function verdictFor(score: number): Verdict {
  if (score >= 0.999) return "correct";
  if (score > 0) return "partial";
  return "incorrect";
}

/**
 * Grade everything except `code`, which needs the sandbox and is graded by
 * `executor.ts` before being handed back here via `gradeCode`.
 */
export function grade(item: Item | DrillItem, response: Response): Grade {
  switch (item.type) {
    case "mcq":
      return gradeMcq(item, response);
    case "multi":
      return gradeMulti(item, response);
    case "predict":
      return gradePredict(item, response);
    case "fill":
      return gradeFill(item, response);
    case "order":
      return gradeOrder(item, response);
    case "explain":
      return gradeExplain(item, response);
    case "code":
      // The caller runs the tests and calls gradeCode; if we get here the
      // learner skipped running them.
      return { ...EMPTY, verdict: "incorrect", score: 0, message: "Run the tests first." };
  }
}

// ─── mcq ───

function gradeMcq(item: Item | DrillItem, response: Response): Grade {
  if (response.kind !== "choice") {
    return { ...EMPTY, verdict: "incorrect", score: 0, message: "No answer selected." };
  }
  const correctIndex = Number(item.answer);
  const ok = response.index === correctIndex;
  return {
    ...EMPTY,
    verdict: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    detail: item.choices.map((_, i) => i === correctIndex),
    message: ok ? "Correct." : `The answer is ${letter(correctIndex)}.`,
  };
}

// ─── multi ───

function gradeMulti(item: Item | DrillItem, response: Response): Grade {
  if (response.kind !== "choices") {
    return { ...EMPTY, verdict: "incorrect", score: 0, message: "No answers selected." };
  }
  const correct = new Set((item.answer as number[]) ?? []);
  const picked = new Set(response.indices);

  // Jaccard-style credit: reward hits, punish false positives equally.
  let hit = 0;
  let wrong = 0;
  for (const i of picked) {
    if (correct.has(i)) hit++;
    else wrong++;
  }
  const missed = correct.size - hit;
  const score = correct.size === 0 ? 0 : Math.max(0, (hit - wrong) / correct.size);

  return {
    ...EMPTY,
    verdict: verdictFor(score),
    score,
    detail: item.choices.map((_, i) => correct.has(i)),
    message:
      score >= 1
        ? "All correct."
        : `${hit}/${correct.size} correct` +
          (wrong ? `, ${wrong} wrong pick${wrong > 1 ? "s" : ""}` : "") +
          (missed ? `, ${missed} missed` : "") +
          ".",
  };
}

// ─── predict ───

/**
 * Console output comparison is a minefield of whitespace and quote styles, so
 * normalise hard: collapse whitespace, drop trailing semicolons and commas,
 * unify quotes, and treat newlines as separators.
 */
export function normalizeOutput(raw: string): string {
  return raw
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/['`]/g, '"')
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/,\s*/g, ", ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/[;]+$/gm, "")
    .toLowerCase();
}

function gradePredict(item: Item | DrillItem, response: Response): Grade {
  if (response.kind !== "text") {
    return { ...EMPTY, verdict: "incorrect", score: 0, message: "No answer given." };
  }
  const expected = String(item.answer ?? "");
  const ok = normalizeOutput(response.text) === normalizeOutput(expected);
  return {
    ...EMPTY,
    verdict: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    message: ok ? "Exactly right." : "Not quite — compare line by line.",
  };
}

// ─── fill ───

function gradeFill(item: Item | DrillItem, response: Response): Grade {
  if (response.kind !== "blanks") {
    return { ...EMPTY, verdict: "incorrect", score: 0, message: "No answer given." };
  }
  const expected = (item.answer as string[]) ?? [];
  const detail = expected.map((exp, i) => matchesBlank(response.blanks[i] ?? "", exp));
  const hit = detail.filter(Boolean).length;
  const score = expected.length === 0 ? 0 : hit / expected.length;
  return {
    ...EMPTY,
    verdict: verdictFor(score),
    score,
    detail,
    message: score >= 1 ? "Every blank right." : `${hit}/${expected.length} blanks correct.`,
  };
}

/**
 * A blank accepts any of several spellings, written in the content as
 * "await|Promise.all". Comparison ignores case and surrounding whitespace but
 * not internal punctuation — `=== ` really is different from `==`.
 */
function matchesBlank(given: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return expected.split("|").some((alt) => norm(alt) === norm(given));
}

// ─── order ───

function gradeOrder(item: Item | DrillItem, response: Response): Grade {
  if (response.kind !== "order") {
    return { ...EMPTY, verdict: "incorrect", score: 0, message: "No ordering given." };
  }
  const expected = (item.answer as number[]) ?? [];
  const detail = expected.map((exp, i) => response.order[i] === exp);
  const hit = detail.filter(Boolean).length;
  // All-or-nothing feels harsh, but a half-right pipeline is still wrong in
  // production, so weight positional credit quadratically.
  const raw = expected.length === 0 ? 0 : hit / expected.length;
  const score = raw >= 1 ? 1 : raw * raw;
  return {
    ...EMPTY,
    verdict: verdictFor(score),
    score,
    detail,
    message: raw >= 1 ? "Correct order." : `${hit}/${expected.length} in the right position.`,
  };
}

// ─── explain ───

/**
 * We can't mark a spoken answer, but we can tell the learner which concepts
 * they left out — which is the actually useful feedback — and then let them
 * rate themselves.
 */
function gradeExplain(item: Item | DrillItem, response: Response): Grade {
  const text = response.kind === "selfRated" || response.kind === "text" ? response.text : "";
  const { hits, misses } = keywordScore(text, item.keywords);
  const total = item.keywords.length || 1;
  const score = hits.length / total;

  // Self-rating wins when present — the learner knows whether they could
  // actually say this out loud.
  if (response.kind === "selfRated") {
    const verdict: Verdict =
      response.rating >= 3 ? "correct" : response.rating === 2 ? "partial" : "incorrect";
    return {
      ...EMPTY,
      verdict,
      score: response.rating >= 3 ? 1 : response.rating === 2 ? 0.5 : 0,
      hits,
      misses,
      message: `You covered ${hits.length} of ${total} key points.`,
    };
  }

  return {
    ...EMPTY,
    verdict: verdictFor(score),
    score,
    hits,
    misses,
    message: `You covered ${hits.length} of ${total} key points.`,
  };
}

/**
 * Keyword matching with a little tolerance: a keyword written as
 * "event loop|call stack" matches either, and word boundaries stop "this"
 * from matching inside "something".
 */
export function keywordScore(text: string, keywords: string[]): { hits: string[]; misses: string[] } {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ")} `;
  const hits: string[] = [];
  const misses: string[] = [];

  for (const keyword of keywords) {
    const alternatives = keyword.split("|").map((k) => k.trim().toLowerCase());
    const found = alternatives.some((alt) => haystack.includes(` ${alt} `) || haystack.includes(` ${alt}`));
    (found ? hits : misses).push(alternatives[0]);
  }
  return { hits, misses };
}

// ─── code ───

export function gradeCode(
  tests: Grade["tests"]
): Grade {
  const passed = tests.filter((t) => t.passed).length;
  const score = tests.length === 0 ? 0 : passed / tests.length;
  return {
    ...EMPTY,
    verdict: verdictFor(score),
    score,
    detail: tests.map((t) => t.passed),
    tests,
    message:
      score >= 1
        ? `All ${tests.length} tests passed.`
        : `${passed}/${tests.length} tests passed.`,
  };
}

// ─── FSRS rating ───

/**
 * Turn a grade into a review rating. Speed matters for interview recall — an
 * answer you had to think about for a minute is not one you "know".
 */
export function ratingFor(
  grade: Grade,
  timeSpent: number,
  estSeconds: number,
  usedHint: boolean
): Rating {
  if (grade.verdict === "incorrect") return 1;
  if (grade.verdict === "partial") return 2;
  if (usedHint) return 2;
  if (timeSpent > estSeconds * 2) return 2;
  if (timeSpent < estSeconds * 0.5) return 4;
  return 3;
}

export function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Used by the review UI to show the canonical answer for any item type. */
export function answerText(item: Item | DrillItem): string {
  switch (item.type) {
    case "mcq":
      return `${letter(Number(item.answer))} — ${item.choices[Number(item.answer)] ?? ""}`;
    case "multi":
      return ((item.answer as number[]) ?? [])
        .map((i) => `${letter(i)} — ${item.choices[i] ?? ""}`)
        .join("\n");
    case "predict":
      return String(item.answer ?? "");
    case "fill":
      return ((item.answer as string[]) ?? []).map((a, i) => `${i + 1}. ${a.split("|")[0]}`).join("\n");
    case "order":
      return ((item.answer as number[]) ?? [])
        .map((c, i) => `${i + 1}. ${item.choices[c] ?? ""}`)
        .join("\n");
    case "explain":
      return item.modelAnswer;
    case "code":
      return item.solutionCode;
  }
}

export { deepEqual };
