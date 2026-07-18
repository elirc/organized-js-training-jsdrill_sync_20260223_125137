"use client";

import { tierLabel } from "@/lib/utils";
import type { CategoryProgress } from "@/types";

type CategoryStrengthProps = {
  categories: CategoryProgress[];
};

export function CategoryStrength({ categories }: CategoryStrengthProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Category Progress
      </h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const progress =
            cat.totalProblems > 0
              ? (cat.solvedProblems / cat.totalProblems) * 100
              : 0;

          return (
            <div key={cat.categoryId} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{cat.categoryIcon}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {cat.categoryName}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {tierLabel(cat.currentTier)} · {cat.solvedProblems}/
                  {cat.totalProblems} solved
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
