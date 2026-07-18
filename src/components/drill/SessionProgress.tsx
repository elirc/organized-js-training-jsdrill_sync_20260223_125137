"use client";

import { cn } from "@/lib/utils";

type SessionProgressProps = {
  current: number;
  total: number;
  timeElapsed?: number;
};

export function SessionProgress({
  current,
  total,
  timeElapsed,
}: SessionProgressProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
      <span className="text-sm font-semibold text-indigo-700">Reps</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">
            Session: {current}/{total}
          </span>
          {timeElapsed !== undefined && (
            <span className="text-xs text-gray-500 font-mono">
              {formatTime(timeElapsed)}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              progress === 100 ? "bg-green-500" : "bg-indigo-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
