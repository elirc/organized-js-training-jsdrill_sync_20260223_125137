"use client";

import { cn } from "@/lib/utils";
import type { ExecutionResult } from "@/types";

type TestResultsProps = {
  results: ExecutionResult;
};

export function TestResults({ results }: TestResultsProps) {
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold",
          results.allPassed
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        )}
      >
        <span>{results.allPassed ? "✅" : "❌"}</span>
        <span>
          {results.allPassed
            ? "All tests passed!"
            : `${results.results.filter((r) => r.passed).length}/${results.results.length} tests passed`}
        </span>
        {results.errorType && !results.allPassed && (
          <span className="ml-auto text-xs opacity-75">
            Type: {results.errorType}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {results.results.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 px-3 py-2 rounded-lg text-xs border",
              r.passed
                ? "bg-green-50/50 border-green-100"
                : "bg-red-50/50 border-red-100"
            )}
          >
            <span className="mt-0.5">{r.passed ? "✓" : "✗"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-700">
                {r.testCase.description}
              </div>
              {!r.passed && (
                <div className="mt-1 space-y-1">
                  {r.error ? (
                    <div className="text-red-600 font-mono">{r.error}</div>
                  ) : (
                    <>
                      <div className="text-gray-500">
                        Expected:{" "}
                        <span className="font-mono text-green-700">
                          {JSON.stringify(r.expected)}
                        </span>
                      </div>
                      <div className="text-gray-500">
                        Got:{" "}
                        <span className="font-mono text-red-600">
                          {JSON.stringify(r.result)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
