import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getModules, getTrackBySlug } from "@/lib/content";
import { getTrackProgress } from "@/lib/progress";
import { accent, masteryColor, masteryLabel } from "@/lib/theme";
import { cn, levelLabel, pct } from "@/lib/utils";
import type { Level } from "@/types";

export const dynamic = "force-dynamic";

const LEVELS: Level[] = ["foundation", "working", "professional"];

const LEVEL_BLURB: Record<Level, string> = {
  foundation: "The things you're expected to know before anyone asks.",
  working: "What you use on a normal day, and where the bugs come from.",
  professional: "The judgement calls that separate mid-level from junior.",
};

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track: trackSlug } = await params;
  const track = getTrackBySlug(trackSlug);
  if (!track) notFound();

  const modules = getModules(track.id);
  const progress = getTrackProgress(DEFAULT_USER_ID).find((t) => t.trackId === track.id);
  const tone = accent(track.accent);

  const byModuleId = new Map((progress?.modules ?? []).map((m) => [m.moduleId, m]));

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Link href="/learn" className="text-xs ink-muted hover:text-[var(--ink)]">
          ← Roadmap
        </Link>

        <div className="flex items-start gap-4">
          <span
            className={cn(
              "h-11 w-11 rounded-xl grid place-items-center text-sm font-bold shrink-0",
              tone.bgSoft,
              tone.text
            )}
          >
            {track.icon}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{track.name}</h1>
            <p className="text-sm ink-muted mt-0.5">{track.tagline}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed ink-muted max-w-2xl">{track.description}</p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href={`/drill?mode=track&track=${track.slug}`}>
            <Button>Practise this track</Button>
          </Link>
          <Link href={`/interview?tracks=${track.slug}`}>
            <Button variant="secondary">Mock interview</Button>
          </Link>
          {progress && (
            <span className="text-xs ink-muted ml-auto tabular-nums">
              {pct(progress.mastery)} · {progress.seenItems}/{progress.totalItems} seen
              {progress.dueItems > 0 && ` · ${progress.dueItems} due`}
            </span>
          )}
        </div>
      </header>

      {LEVELS.map((level) => {
        const levelModules = modules.filter((m) => m.level === level);
        if (levelModules.length === 0) return null;

        return (
          <section key={level} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">{levelLabel(level)}</h2>
              <p className="text-xs ink-muted">{LEVEL_BLURB[level]}</p>
            </div>

            <div className="space-y-2">
              {levelModules.map((mod) => {
                const modProgress = byModuleId.get(mod.id);
                const mastery = modProgress?.mastery ?? 0;

                return (
                  <Link key={mod.id} href={`/learn/${track.slug}/${mod.slug}`} className="block">
                    <Card className="hover:border-indigo-400 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm">{mod.name}</h3>
                            {modProgress && modProgress.dueItems > 0 && (
                              <Badge variant="info">{modProgress.dueItems} due</Badge>
                            )}
                            {modProgress?.status === "mastered" && (
                              <Badge variant="success">Mastered</Badge>
                            )}
                          </div>
                          <p className="text-xs ink-muted mt-1 leading-relaxed">{mod.summary}</p>
                        </div>

                        <div className="shrink-0 w-28 space-y-1.5 pt-1">
                          <ProgressBar
                            value={mastery}
                            className="h-1"
                            barClassName={masteryColor(mastery)}
                          />
                          <p className="text-[10px] ink-muted text-right tabular-nums">
                            {modProgress
                              ? `${modProgress.seenItems}/${modProgress.totalItems} · ${masteryLabel(mastery)}`
                              : masteryLabel(0)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
