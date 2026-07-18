"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatTime } from "@/lib/utils";
import type { SessionProblem, ExecutionResult } from "@/types";

type PostSolveProps = {
  problem: SessionProblem;
  results: ExecutionResult;
  approachText: string;
  timeSpent: number;
  onNext: () => void;
  isLastProblem: boolean;
};

export function PostSolve({
  problem,
  results,
  approachText,
  timeSpent,
  onNext,
  isLastProblem,
}: PostSolveProps) {
  return (
    <div className="space-y-4">
      {/* Result banner */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-lg ${
          results.allPassed
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{results.allPassed ? "✅" : "❌"}</span>
          <span
            className={`font-semibold ${results.allPassed ? "text-green-700" : "text-red-700"}`}
          >
            {results.allPassed ? "All tests passed" : "Some tests failed"}
          </span>
        </div>
        <span className="text-sm text-gray-500 font-mono">
          {formatTime(timeSpent)}
        </span>
      </div>

      {/* Approach recap */}
      {approachText && (
        <Card padding="sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Your Approach
          </h4>
          <p className="text-sm text-gray-700 italic">&quot;{approachText}&quot;</p>
        </Card>
      )}

      {/* Pattern reveal */}
      {problem.patterns.length > 0 && (
        <Card padding="sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pattern
          </h4>
          <div className="flex flex-wrap gap-2">
            {problem.patterns.map((p) => (
              <Badge key={p.id} variant="info">
                {p.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Hints used / solution hint for failed */}
      {!results.allPassed && problem.hints.length > 0 && (
        <Card padding="sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Hints
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {problem.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <Button onClick={onNext} size="lg">
          {isLastProblem ? "Finish Session" : "Next Problem →"}
        </Button>
      </div>
    </div>
  );
}
