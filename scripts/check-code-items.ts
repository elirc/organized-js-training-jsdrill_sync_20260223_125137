/**
 * Runs every `code` item's authored solution against its own test cases, and
 * checks the starter code does *not* already pass.
 *
 * The sandbox itself is a browser worker, so this reimplements just enough of
 * it — entry-point detection, the `call` driver, deep equality — to exercise
 * the same contract in Node. Run with `npm run check:code`.
 */
import { sqlite } from "../src/lib/db";
import { deepEqual, safeJson } from "../src/lib/utils";
import type { TestCase } from "../src/types";

type Row = { id: string; starter_code: string; solution_code: string; test_cases: string };

function findEntryPoint(code: string): string | null {
  const patterns = [
    /function\s+([a-zA-Z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g,
    /class\s+([a-zA-Z_$][\w$]*)/g,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(code);
    if (match) return match[1];
  }
  return null;
}

function runTest(fn: unknown, test: TestCase): { ok: boolean; got: unknown } {
  try {
    const got =
      typeof test.call === "string"
        ? new Function("fn", test.call)(fn)
        : (fn as (...args: unknown[]) => unknown)(...(test.input ?? []));
    return {
      ok: deepEqual(got, test.expected) || (test.expected === null && got === undefined),
      got,
    };
  } catch (err) {
    return { ok: false, got: `threw: ${(err as Error).message}` };
  }
}

function load(code: string): unknown {
  const entry = findEntryPoint(code);
  if (!entry) throw new Error("no entry point found");
  return new Function(`${code}\n;return ${entry};`)();
}

const rows = sqlite
  .prepare(`SELECT id, starter_code, solution_code, test_cases FROM items WHERE type = 'code'`)
  .all() as Row[];

const failures: string[] = [];
let assertions = 0;

for (const row of rows) {
  const tests = safeJson<TestCase[]>(row.test_cases, []);

  let solution: unknown;
  try {
    solution = load(row.solution_code);
  } catch (err) {
    failures.push(`${row.id}: solution won't load — ${(err as Error).message}`);
    continue;
  }

  let passed = 0;
  for (const test of tests) {
    assertions++;
    const { ok, got } = runTest(solution, test);
    if (ok) passed++;
    else {
      failures.push(
        `${row.id}: "${test.description}" — got ${JSON.stringify(got)}, expected ${JSON.stringify(test.expected)}`
      );
    }
  }

  // If the starter already passes, the exercise asks for nothing.
  try {
    const starter = load(row.starter_code);
    if (tests.every((test) => runTest(starter, test).ok)) {
      failures.push(`${row.id}: the starter code already passes every test`);
    }
  } catch {
    // A starter that doesn't even load is fine — that's the normal case.
  }

  console.log(`  ${passed === tests.length ? "ok  " : "FAIL"} ${row.id} — ${passed}/${tests.length}`);
}

console.log(`\n${assertions} assertions across ${rows.length} code items.`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Every code item's solution passes and its starter doesn't.\n");
