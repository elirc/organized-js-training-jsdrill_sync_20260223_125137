import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getModuleBySlug, getModuleItems, getTrackBySlug } from "@/lib/content";
import { getTrackProgress } from "@/lib/progress";
import { daysUntilDue } from "@/lib/fsrs";
import { accent, masteryColor, masteryLabel } from "@/lib/theme";
import { cn, levelLabel, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  multi: "Select all",
  predict: "Predict output",
  fill: "Fill blanks",
  order: "Ordering",
  code: "Write code",
  explain: "Explain",
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ track: string; module: string }>;
}) {
  const { track: trackSlug, module: moduleSlug } = await params;

  const track = getTrackBySlug(trackSlug);
  const mod = getModuleBySlug(trackSlug, moduleSlug);
  if (!track || !mod) notFound();

  const items = getModuleItems(DEFAULT_USER_ID, mod.id);
  const progress = getTrackProgress(DEFAULT_USER_ID)
    .find((t) => t.trackId === track.id)
    ?.modules.find((m) => m.moduleId === mod.id);

  const tone = accent(track.accent);
  const mastery = progress?.mastery ?? 0;

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-xs ink-muted">
          <Link href="/learn" className="hover:text-[var(--ink)]">
            Roadmap
          </Link>
          <span>/</span>
          <Link href={`/learn/${track.slug}`} className="hover:text-[var(--ink)]">
            {track.name}
          </Link>
        </div>

        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{mod.name}</h1>
            <p className="text-sm ink-muted mt-1">{mod.summary}</p>
          </div>
          <Badge variant="outline" className={cn("mt-1", tone.text)}>
            {levelLabel(mod.level)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/drill?mode=module&track=${track.slug}&module=${mod.slug}`}>
            <Button size="lg">
              {progress && progress.dueItems > 0
                ? `Review ${progress.dueItems} due`
                : `Drill ${items.length} questions`}
            </Button>
          </Link>
          <div className="flex items-center gap-2.5 ml-auto">
            <ProgressBar
              value={mastery}
              className="w-28 h-1.5"
              barClassName={masteryColor(mastery)}
            />
            <span className="text-xs ink-muted tabular-nums whitespace-nowrap">
              {pct(mastery)} · {masteryLabel(mastery)}
            </span>
          </div>
        </div>
      </header>

      {/* What an interviewer is after */}
      {mod.interviewAngle && (
        <Card className="border-l-2 border-l-indigo-500">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1.5">
            What they&apos;re really testing
          </h2>
          <p className="text-sm leading-relaxed">{mod.interviewAngle}</p>
        </Card>
      )}

      {/* The checklist */}
      {mod.keyPoints.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">You should be able to say</h2>
          <Card padding="none">
            <ul className="divide-y hairline">
              {mod.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-[11px] font-mono ink-muted shrink-0 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Question index — prompts only, so it stays a preview rather than a spoiler */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold">Questions in this module</h2>
          <span className="text-xs ink-muted">{items.length} total</span>
        </div>

        <Card padding="none">
          <ul className="divide-y hairline">
            {items.map((item) => {
              const days = item.due ? daysUntilDue(item.due) : null;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "shrink-0 h-1.5 w-1.5 rounded-full mt-2",
                      item.reps === 0
                        ? "bg-slate-300 dark:bg-slate-600"
                        : days === 0
                          ? "bg-indigo-500"
                          : "bg-emerald-500"
                    )}
                    title={
                      item.reps === 0 ? "Not seen yet" : days === 0 ? "Due now" : `Due in ${days}d`
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{item.prompt.split("\n")[0]}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] ink-muted">{TYPE_LABEL[item.type]}</span>
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] ink-muted">
                          · {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] ink-muted shrink-0 pt-0.5 tabular-nums">
                    {item.reps === 0 ? "new" : days === 0 ? "due" : `${days}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </div>
  );
}
