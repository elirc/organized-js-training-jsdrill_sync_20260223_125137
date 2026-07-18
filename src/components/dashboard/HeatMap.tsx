"use client";

import type { DayActivity } from "@/types";

type HeatMapProps = {
  activity: DayActivity[];
};

export function HeatMap({ activity }: HeatMapProps) {
  // Generate last 90 days
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const found = activity.find((a) => a.date === dateStr);
    days.push({ date: dateStr, count: found?.count || 0 });
  }

  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-100";
    if (count <= 2) return "bg-green-200";
    if (count <= 5) return "bg-green-400";
    if (count <= 10) return "bg-green-500";
    return "bg-green-700";
  };

  // Group into weeks (columns of 7)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Activity (Last 90 Days)
      </h3>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
                title={`${day.date}: ${day.count} problems`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100" />
        <div className="w-3 h-3 rounded-sm bg-green-200" />
        <div className="w-3 h-3 rounded-sm bg-green-400" />
        <div className="w-3 h-3 rounded-sm bg-green-500" />
        <div className="w-3 h-3 rounded-sm bg-green-700" />
        <span>More</span>
      </div>
    </div>
  );
}
