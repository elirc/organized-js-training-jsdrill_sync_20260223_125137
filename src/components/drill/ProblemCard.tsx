"use client";

import { Badge } from "@/components/ui/Badge";
import { tierLabel, tierColor } from "@/lib/utils";
import type { SessionProblem } from "@/types";

type ProblemCardProps = {
  problem: SessionProblem;
};

export function ProblemCard({ problem }: ProblemCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${tierColor(problem.tier)}`}
        >
          {tierLabel(problem.tier)}
        </span>
        <Badge variant="info">{problem.categoryName}</Badge>
        {problem.isReview && <Badge variant="warning">Review</Badge>}
      </div>

      <h2 className="text-xl font-bold text-gray-900">{problem.title}</h2>

      <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
        {problem.description}
      </div>
    </div>
  );
}
