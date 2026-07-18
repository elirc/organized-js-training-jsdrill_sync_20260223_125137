import type { TestCase, TestResult, ExecutionResult } from "@/types";
import { deepEqual } from "./utils";

function extractFunctionName(code: string): string | null {
  const match = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
  return match ? match[1] : null;
}

export function executeUserCode(
  userCode: string,
  testCases: TestCase[]
): ExecutionResult {
  const fnName = extractFunctionName(userCode);
  if (!fnName) {
    return {
      allPassed: false,
      results: testCases.map((tc) => ({
        passed: false,
        error: "Could not find a function declaration in your code.",
        testCase: tc,
      })),
      errorType: "syntax-error",
    };
  }

  const results: TestResult[] = testCases.map((tc) => {
    try {
      // Create the function in a sandboxed scope
      const fn = new Function(
        `${userCode};\nreturn ${fnName}(...arguments);`
      );

      const startTime = performance.now();
      const result = fn(...tc.input);
      const elapsed = performance.now() - startTime;

      if (elapsed > 5000) {
        return { passed: false, error: "Timeout (>5s)", testCase: tc };
      }

      // Handle undefined vs null: if expected is null and result is undefined, that's a match
      const passed = deepEqual(result, tc.expected) ||
        (tc.expected === null && result === undefined) ||
        (tc.expected === undefined && result === null);

      return {
        passed,
        result,
        expected: tc.expected,
        testCase: tc,
      };
    } catch (e) {
      return {
        passed: false,
        error: e instanceof Error ? e.message : String(e),
        testCase: tc,
      };
    }
  });

  return {
    allPassed: results.every((r) => r.passed),
    results,
    errorType: classifyError(results),
  };
}

function classifyError(results: TestResult[]): string | null {
  if (results.every((r) => r.passed)) return null;

  const failures = results.filter((r) => !r.passed);

  // Syntax/runtime error
  if (failures.some((r) => r.error && r.error !== "Timeout (>5s)")) {
    return "runtime-error";
  }

  // Timeout
  if (failures.some((r) => r.error === "Timeout (>5s)")) {
    return "timeout";
  }

  // Edge case miss: passed most but failed on edge cases
  if (
    failures.length <= 2 &&
    failures.every((r) => r.testCase.isEdgeCase)
  ) {
    return "edge-case-miss";
  }

  // Type mismatch
  if (
    failures.some(
      (r) =>
        r.result !== undefined &&
        r.expected !== undefined &&
        typeof r.result !== typeof r.expected
    )
  ) {
    return "type-mismatch";
  }

  // Off-by-one: numeric results within 1 of expected
  if (
    failures.some(
      (r) =>
        typeof r.result === "number" &&
        typeof r.expected === "number" &&
        Math.abs(r.result - r.expected) === 1
    )
  ) {
    return "off-by-one";
  }

  // Total failure
  if (failures.length === results.length) {
    return "logic-error";
  }

  return "partial-failure";
}
