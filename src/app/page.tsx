import Link from "next/link";
import { ThemeToggle } from "@/components/Nav";
import { getTracks } from "@/lib/content";
import { accent } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Track } from "@/types";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Answer a real interview question",
    body: "Multiple choice, predict-the-output, fill the blanks, order the steps, write the code, or explain a concept out loud. Seven formats, because that's how you actually get asked.",
  },
  {
    title: "Find out why, not just whether",
    body: "Every answer comes with the reasoning, the trap it's testing, and the follow-up question an interviewer would ask next.",
  },
  {
    title: "See it again exactly when you'd forget",
    body: "A spaced-repetition scheduler brings back what's fading and leaves alone what's stuck. Your progress decays if you stop, because so does your recall.",
  },
];

export default function Landing() {
  let tracks: Track[] = [];
  try {
    tracks = getTracks();
  } catch {
    // Unseeded database — the hero still renders and the setup note shows.
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b hairline">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-semibold tracking-tight">Ramp</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-14">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">
              JavaScript · TypeScript · React · Node · C# · .NET
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
              Get from &ldquo;I can follow a tutorial&rdquo; to
              <br />
              <span className="text-indigo-600 dark:text-indigo-400">
                mid-level CRUD developer
              </span>
            </h1>
            <p className="mt-6 text-base leading-relaxed ink-muted">
              A structured path through the things interviewers actually ask about this stack — how
              closures work, why your effect runs twice, what N+1 is, which DI lifetime a DbContext
              needs. No LeetCode. No binary trees. Just the working knowledge the job assumes you
              have.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/learn"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
              >
                See the roadmap
              </Link>
              <Link
                href="/drill"
                className="inline-flex items-center px-5 py-2.5 rounded-lg border hairline surface text-sm font-medium hover:bg-[var(--surface-muted)] transition-colors"
              >
                Start practising →
              </Link>
            </div>
          </div>
        </section>

        {/* Tracks */}
        {tracks.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-16">
            <h2 className="text-xs font-medium uppercase tracking-widest ink-muted mb-5">
              Seven tracks, in order
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tracks.map((track, i) => {
                const tone = accent(track.accent);
                return (
                  <Link
                    key={track.id}
                    href={`/learn/${track.slug}`}
                    className="group surface border rounded-xl p-4 hover:border-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <span
                        className={cn(
                          "h-7 w-7 rounded-lg grid place-items-center text-[11px] font-bold",
                          tone.bgSoft,
                          tone.text
                        )}
                      >
                        {track.icon}
                      </span>
                      <span className="font-medium text-sm">{track.name}</span>
                      <span className="ml-auto text-[11px] ink-muted tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="text-xs ink-muted leading-relaxed">{track.tagline}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="border-t hairline bg-[var(--surface)]">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <h2 className="text-xs font-medium uppercase tracking-widest ink-muted mb-8">
              How a session works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title}>
                  <span className="text-xs font-mono ink-muted">0{i + 1}</span>
                  <h3 className="font-medium mt-2 mb-2">{step.title}</h3>
                  <p className="text-sm ink-muted leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Setup note when the DB is empty */}
        {tracks.length === 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <div className="surface border rounded-xl p-6">
              <h2 className="font-medium mb-2">One step before you start</h2>
              <p className="text-sm ink-muted mb-4">
                The content database hasn&apos;t been seeded yet. Run this once:
              </p>
              <pre className="snippet rounded-lg border hairline bg-[var(--surface-muted)] p-3">
                npm run db:seed
              </pre>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t hairline">
        <div className="max-w-5xl mx-auto px-4 py-6 text-xs ink-muted">
          Runs locally on SQLite. Your answers and schedule never leave the machine.
        </div>
      </footer>
    </div>
  );
}
