import Link from "next/link";
import { Badge, Card, EmptyState, ProgressBar } from "@/components/ui";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getDashboard } from "@/lib/progress";
import { accent, masteryColor, masteryLabel } from "@/lib/theme";
import { cn, daysAgo, formatDuration, localDay, pct } from "@/lib/utils";
import type { DayActivity } from "@/types";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getDashboard(DEFAULT_USER_ID);
  const { stats } = data;

  if (stats.totalAttempts === 0) {
    return (
      <EmptyState
        icon="📈"
        title="Nothing to show yet"
        body="Answer a few questions and this fills up with what you know, what's fading, and which topics would trip you up in an interview."
        action={
          <Link
            href="/drill"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
          >
            Start practising
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm ink-muted mt-1">
          Mastery is weighted by how well you&apos;d still recall each item, so it fades if you stop
          reviewing.
        </p>
      </header>

      {/* Headline numbers */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Interview readiness"
          value={pct(stats.readiness)}
          hint={masteryLabel(stats.readiness)}
        />
        <Stat
          label="Questions seen"
          value={`${stats.itemsSeen}`}
          hint={`of ${stats.itemsTotal}`}
        />
        <Stat
          label="Accuracy"
          value={pct(stats.accuracy)}
          hint={`${stats.totalAttempts} answers`}
        />
        <Stat
          label="Streak"
          value={`${stats.streak}`}
          hint={stats.streak === 1 ? "day" : "days"}
        />
      </div>

      {stats.dueToday > 0 && (
        <Card className="flex flex-wrap items-center gap-4 border-indigo-500/40">
          <div>
            <p className="font-medium text-sm">{stats.dueToday} questions are due for review</p>
            <p className="text-xs ink-muted mt-0.5">
              These are the ones you&apos;re about to forget. Clearing them is the highest-value
              thing you can do today.
            </p>
          </div>
          <Link
            href="/drill?mode=mixed"
            className="ml-auto inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Review now
          </Link>
        </Card>
      )}

      {/* Activity */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold">Last 15 weeks</h2>
          <span className="text-xs ink-muted">
            {formatDuration(stats.minutesPracticed * 60)} practised
          </span>
        </div>
        <Card>
          <HeatMap activity={data.activity} />
        </Card>
      </section>

      {/* Weak spots */}
      {data.weakSpots.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Where you&apos;d get caught out</h2>
            <Link
              href="/drill?mode=weak"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Drill these →
            </Link>
          </div>
          <Card padding="none">
            <ul className="divide-y hairline">
              {data.weakSpots.map((spot) => (
                <li key={spot.tag} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm w-40 shrink-0 truncate">{spot.tag}</span>
                  <span className="text-[11px] ink-muted w-24 shrink-0 truncate hidden sm:block">
                    {spot.trackName}
                  </span>
                  <ProgressBar
                    value={spot.accuracy}
                    className="flex-1"
                    barClassName={spot.accuracy < 0.5 ? "bg-rose-500" : "bg-amber-500"}
                  />
                  <span className="text-[11px] ink-muted tabular-nums w-14 text-right shrink-0">
                    {spot.correct}/{spot.attempts}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Track mastery */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Mastery by track</h2>
        <div className="space-y-2">
          {data.tracks.map((track) => {
            const tone = accent(track.accent);
            return (
              <Link key={track.trackId} href={`/learn/${track.trackSlug}`} className="block">
                <Card className="hover:border-indigo-400 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={cn(
                        "h-7 w-7 rounded-lg grid place-items-center text-[10px] font-bold shrink-0",
                        tone.bgSoft,
                        tone.text
                      )}
                    >
                      {track.icon}
                    </span>
                    <span className="text-sm font-medium">{track.trackName}</span>
                    {track.dueItems > 0 && <Badge variant="info">{track.dueItems} due</Badge>}
                    <span className="ml-auto text-xs ink-muted tabular-nums">
                      {pct(track.mastery)}
                    </span>
                  </div>

                  {/* One segment per module — a quick read of where the holes are */}
                  <div className="flex gap-1">
                    {track.modules.map((mod) => (
                      <div
                        key={mod.moduleId}
                        title={`${mod.moduleName} — ${pct(mod.mastery)}`}
                        className={cn("h-1.5 flex-1 rounded-full", masteryColor(mod.mastery))}
                      />
                    ))}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Interview history */}
      {data.recentInterviews.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Recent mock interviews</h2>
          <Card padding="none">
            <ul className="divide-y hairline">
              {data.recentInterviews.map((run) => (
                <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="ink-muted w-24 shrink-0">{localDay(run.createdAt)}</span>
                  <span className="ink-muted flex-1 truncate">
                    {run.trackSlugs.length > 0 ? run.trackSlugs.join(", ") : "all tracks"}
                  </span>
                  <span className="tabular-nums">
                    {run.correct}/{run.total}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums font-medium w-10 text-right",
                      run.score >= 0.85
                        ? "text-emerald-600 dark:text-emerald-400"
                        : run.score >= 0.65
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {Math.round(run.score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-wide ink-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1.5">{value}</p>
      <p className="text-[11px] ink-muted mt-0.5">{hint}</p>
    </Card>
  );
}

/** 15 weeks of activity, one column per week, GitHub-style. */
function HeatMap({ activity }: { activity: DayActivity[] }) {
  const WEEKS = 15;
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const today = new Date();

  // Start on the Sunday that begins the earliest visible week so columns line up.
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1) - today.getDay());

  const columns: (DayActivity | null)[][] = [];
  const cursor = new Date(start);
  const todayKey = localDay();

  for (let week = 0; week < WEEKS + 1; week++) {
    const column: (DayActivity | null)[] = [];
    for (let day = 0; day < 7; day++) {
      const key = localDay(cursor);
      column.push(key > todayKey ? null : (byDate.get(key) ?? { date: key, count: 0, correct: 0 }));
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(column);
  }

  const max = Math.max(4, ...activity.map((a) => a.count));

  return (
    <div className="space-y-2">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((column, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {column.map((day, j) =>
              day === null ? (
                <div key={j} className="h-2.5 w-2.5" />
              ) : (
                <div
                  key={j}
                  title={`${day.date}: ${day.count} answered`}
                  className={cn("h-2.5 w-2.5 rounded-[2px]", intensity(day.count, max))}
                />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] ink-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn("h-2.5 w-2.5 rounded-[2px]", intensity((level * max) / 4, max))}
          />
        ))}
        <span>More</span>
        <span className="ml-auto">since {daysAgo(WEEKS * 7)}</span>
      </div>
    </div>
  );
}

function intensity(count: number, max: number): string {
  if (count <= 0) return "bg-slate-200 dark:bg-slate-800";
  const ratio = count / max;
  if (ratio <= 0.25) return "bg-indigo-200 dark:bg-indigo-900";
  if (ratio <= 0.5) return "bg-indigo-300 dark:bg-indigo-700";
  if (ratio <= 0.75) return "bg-indigo-400 dark:bg-indigo-600";
  return "bg-indigo-500 dark:bg-indigo-500";
}
