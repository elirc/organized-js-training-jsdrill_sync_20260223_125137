import { Nav } from "@/components/Nav";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getTrackProgress } from "@/lib/progress";

// Every page in here reads the local SQLite file, so there is nothing to
// prerender at build time.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  let dueCount = 0;
  try {
    dueCount = getTrackProgress(DEFAULT_USER_ID).reduce((sum, t) => sum + t.dueItems, 0);
  } catch {
    // An unseeded database shouldn't stop the shell rendering — the pages
    // below explain what to do about it.
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav dueCount={dueCount} />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-7">{children}</div>
      </main>
      <footer className="border-t hairline">
        <div className="max-w-5xl mx-auto px-4 py-5 text-xs ink-muted">
          Ramp — interview practice for the JS/TS/React/Node and C#/.NET stack. Runs entirely on
          your machine.
        </div>
      </footer>
    </div>
  );
}
