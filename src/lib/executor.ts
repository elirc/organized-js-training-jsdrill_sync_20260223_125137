import type { ExecutionResult, TestCase } from "@/types";

const TIMEOUT_MS = 3000;

/**
 * Run learner code against test cases in a worker.
 *
 * The worker is spawned per run and terminated afterwards: it's the only way
 * to interrupt a runaway loop, and it also guarantees each run starts from a
 * clean global scope so a previous attempt can't leak state into this one.
 */
export function runCode(
  code: string,
  testCases: TestCase[],
  entryPoint?: string
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker("/sandbox.js");
    } catch {
      resolve(failAll(testCases, "Could not start the code sandbox.", "sandbox-unavailable"));
      return;
    }

    const timer = setTimeout(() => {
      worker.terminate();
      resolve(
        failAll(
          testCases,
          `Timed out after ${TIMEOUT_MS / 1000}s — check for an infinite loop.`,
          "timeout"
        )
      );
    }, TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<ExecutionResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(failAll(testCases, event.message || "The sandbox crashed.", "runtime-error"));
    };

    worker.postMessage({ code, testCases, entryPoint });
  });
}

function failAll(testCases: TestCase[], error: string, errorType: string): ExecutionResult {
  return {
    allPassed: false,
    logs: [],
    errorType,
    results: testCases.map((testCase) => ({ passed: false, error, testCase })),
  };
}

/** Human-readable hint for each error classification. */
export function errorHint(errorType: string | null): string | null {
  switch (errorType) {
    case "no-function":
      return "Your code needs a named function — the tests call it by name.";
    case "syntax-error":
      return "The code didn't parse. Check brackets, commas and quotes.";
    case "timeout":
      return "Something never finished. A loop condition probably never becomes false.";
    case "edge-case-miss":
      return "The main cases work — you're missing an edge case. Empty input? Nulls? One element?";
    case "logic-error":
      return "Nothing passed, so the core approach is off rather than a small slip.";
    case "partial-failure":
      return "Some cases pass and some don't. Find what's different about the failing ones.";
    case "runtime-error":
      return "It threw. Read the error message — it usually names the exact value that was wrong.";
    default:
      return null;
  }
}
