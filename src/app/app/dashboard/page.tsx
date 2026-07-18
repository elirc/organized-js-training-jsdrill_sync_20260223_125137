"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { HeatMap } from "@/components/dashboard/HeatMap";
import { CategoryStrength } from "@/components/dashboard/CategoryStrength";
import { PatternMap } from "@/components/dashboard/PatternMap";
import type { CategoryProgress, PatternStrength, DayActivity } from "@/types";

type DashboardData = {
  categoryProgress: CategoryProgress[];
  activity: DayActivity[];
  patternStrengths: PatternStrength[];
  stats: {
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-gray-500">Failed to load dashboard data.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600">
              {data.stats.totalAttempts}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Attempts</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {data.stats.passedAttempts}
            </div>
            <div className="text-xs text-gray-500 mt-1">Problems Solved</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">
              {data.stats.passRate}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Pass Rate</div>
          </div>
        </Card>
      </div>

      {/* Activity heat map */}
      <Card>
        <HeatMap activity={data.activity} />
      </Card>

      {/* Category progress */}
      <Card>
        <CategoryStrength categories={data.categoryProgress} />
      </Card>

      {/* Pattern map */}
      <Card>
        <PatternMap patterns={data.patternStrengths} />
      </Card>
    </div>
  );
}
