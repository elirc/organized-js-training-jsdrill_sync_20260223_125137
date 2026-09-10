/**
 * Feeds every authored item its own canonical answer and asserts the grader
 * marks it correct — and, for choice types, that a deliberately wrong answer is
 * marked incorrect.
 *
 * This is the check that catches a grader and the content disagreeing: an
 * answer index stored as a string, a `fill` whose alternatives don't match what
 * the normaliser produces, a `predict` whose expected output can't be typed
 * back in. Run with `npm run check:gradable`.
 */
import { grade } from "../src/lib/grading";
import { mapItem } from "../src/lib/content";
import { sqlite } from "../src/lib/db";
import type { Item, Response } from "../src/types";

type Row = Parameters<typeof mapItem>[0];

function correctResponse(item: Item): Response | null {
  switch (item.type) {
    case "mcq":
      return { kind: "choice", index: Number(item.answer) };
    case "multi":
      return { kind: "choices", indices: item.answer as number[] };
    case "predict":
      return { kind: "text", text: String(item.answer) };
    case "fill":
      // Use the first alternative of each blank — the spelling a learner is
      // most likely to type.
      return { kind: "blanks", blanks: (item.answer as string[]).map((a) => a.split("|")[0]) };
    case "order":
      return { kind: "order", order: item.answer as number[] };
    case "explain":
    case "code":
      return null; // graded by self-rating and the sandbox respectively
  }
}

/** A plausible wrong answer, to prove the grader isn't just saying yes. */
function wrongResponse(item: Item): Response | null {
  switch (item.type) {
    case "mcq": {
      const correct = Number(item.answer);
      return { kind: "choice", index: (correct + 1) % item.choices.length };
    }
    case "multi": {
      const correct = new Set(item.answer as number[]);
      const wrong = item.choices.map((_, i) => i).filter((i) => !correct.has(i));
      return wrong.length ? { kind: "choices", indices: wrong } : null;
    }
    case "predict":
      return { kind: "text", text: "definitely not the answer" };
    case "order": {
      const correct = item.answer as number[];
      if (correct.length < 2) return null;
      return { kind: "order", order: [...correct].reverse() };
    }
    default:
      return null;
  }
}

const rows = sqlite
  .prepare(
    `SELECT id, module_id, track_id, type, difficulty, frequency, tags, prompt, code,
            language, choices, answer, explanation, follow_up, keywords, model_answer,
            starter_code, solution_code, test_cases, est_seconds, sort_order
     FROM items ORDER BY id`
  )
  .all() as Row[];

const failures: string[] = [];
let checked = 0;
let negativesChecked = 0;

for (const row of rows) {
  const item = mapItem(row);

  const right = correctResponse(item);
  if (right) {
    checked++;
    const result = grade(item, right);
    if (result.verdict !== "correct") {
      failures.push(
        `${item.id} (${item.type}): its own answer grades as "${result.verdict}" — ${result.message}`
      );
    }
  }

  const wrong = wrongResponse(item);
  if (wrong) {
    negativesChecked++;
    const result = grade(item, wrong);
    if (result.verdict === "correct") {
      failures.push(`${item.id} (${item.type}): a deliberately wrong answer grades as correct`);
    }
  }
}

console.log(
  `\nChecked ${checked} auto-gradable items (${negativesChecked} also checked against a wrong answer) of ${rows.length} total.`
);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Every item is answerable and the grader agrees.\n");
