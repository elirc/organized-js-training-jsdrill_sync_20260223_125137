"use client";

import type { PatternStrength } from "@/types";

type PatternMapProps = {
  patterns: PatternStrength[];
};

export function PatternMap({ patterns }: PatternMapProps) {
  const getColor = (strength: PatternStrength["strength"]) => {
    switch (strength) {
      case "none":
        return "bg-gray-100 text-gray-400 border-gray-200";
      case "weak":
        return "bg-red-50 text-red-700 border-red-200";
      case "learning":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "strong":
        return "bg-green-50 text-green-700 border-green-200";
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Pattern Map</h3>
      <div className="flex flex-wrap gap-2">
        {patterns.map((pat) => (
          <div
            key={pat.patternId}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${getColor(pat.strength)}`}
            title={`${pat.solvedProblems}/${pat.totalProblems} solved · Stability: ${pat.averageStability}`}
          >
            {pat.patternName}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Not started
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
          Weak
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
          Learning
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-50 border border-green-200" />
          Strong
        </span>
      </div>
    </div>
  );
}
