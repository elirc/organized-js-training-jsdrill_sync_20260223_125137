import Link from "next/link";
import { Badge, Card, EmptyState, ProgressBar } from "@/components/ui";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getNextModule, getTrackProgress } from "@/lib/progress";
import { accent, masteryColor, masteryLabel } from "@/lib/theme";
import { cn, levelLabel, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function RoadmapPage() {
  const tracks = getTrackProgress(DEFAULT_USER_ID);
  const next = getNextModule(DEFAULT_USER_ID);

  if (tracks.length === 0) {
    return (
      <EmptyState
        icon="🌱"
        title="No content yet"
        body="Run npm run db:seed to load the question bank, then refresh."
      />
    );
  }

  const totalItems = tracks.reduce((s, t) => s + t.totalItems, 0);
  const seenItems = tracks.reduce((s, t) => s + t.seenItems, 0);
  const overall =
    totalItems === 0 ? 0 : tracks.reduce((s, t) => s + t.mastery * t.totalItems, 0) / totalItems;

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">The roadmap</h1>
        <p className="text-sm ink-muted max-w-2xl">
          Seven tracks in the order they build on each other. Nothing is locked — the path is a
          recommendation, and your daily practice pulls new material from wherever you are on it.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <ProgressBar value={overall} className="flex-1 max-w-sm h-2" />
          <span className="text-xs ink-muted tabular-nums">
            {pct(overall)} overall · {seenItems}/{totalItems} questions seen
          </span>
        </div>
      </header>

      {next && (
        <Card className="flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide ink-muted">Up next</p>
            <p className="font-medium mt-0.5">{next.moduleName}</p>
            <p className="text-xs ink-muted mt-0.5">
              {next.seenItems}/{next.totalItems} seen · {masteryLabel(next.mastery)}
            </p>
          </div>
          <Link
            href={`/learn/${next.trackSlug}/${next.moduleSlug}`}
            className="ml-auto inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Open module →
          </Link>
        </Card>
      )}

      <div className="space-y-5">
        {tracks.map((track, trackIndex) => {
          const tone = accent(track.accent);
          return (
            <section key={track.trackId}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={cn(
                    "h-8 w-8 rounded-lg grid place-items-center text-[11px] font-bold shrink-0",
                    tone.bgSoft,
                    tone.text
                  )}
                >
                  {track.icon}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/learn/${track.trackSlug}`}
                    className="font-medium hover:underline underline-offset-4"
                  >
                    {track.trackName}
                  </Link>
                  <p className="text-xs ink-muted truncate">{track.tagline}</p>
                </div>
                <div className="ml-auto flex items-center gap-3 shrink-0">
                  {track.dueItems > 0 && <Badge variant="info">{track.dueItems} due</Badge>}
                  <span className="text-xs ink-muted tabular-nums">{pct(track.mastery)}</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {track.modules.map((mod) => (
                  <Link
                    key={mod.moduleId}
                    href={`/learn/${track.trackSlug}/${mod.moduleSlug}`}
                    className={cn(
                      "surface border rounded-lg p-3 hover:border-indigo-400 transition-colors",
                      mod.status === "mastered" && "border-emerald-500/40"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-sm font-medium leading-tight">{mod.moduleName}</span>
                      {mod.dueItems > 0 && (
                        <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={mod.mastery}
                        className="flex-1 h-1"
                        barClassName={masteryColor(mod.mastery)}
                      />
                      <span className="text-[10px] ink-muted tabular-nums shrink-0">
                        {mod.seenItems}/{mod.totalItems}
                      </span>
                    </div>
                    <p className="text-[10px] ink-muted mt-1.5">
                      {levelLabel(mod.level)} · {masteryLabel(mod.mastery)}
                    </p>
                  </Link>
                ))}
              </div>

              {trackIndex < tracks.length - 1 && <div className="h-2" />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
