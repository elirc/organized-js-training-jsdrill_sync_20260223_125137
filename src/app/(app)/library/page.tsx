import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Prose } from "@/components/ui/Prose";
import { DEFAULT_USER_ID } from "@/lib/db";
import { getSavedItemIds, getTracks, searchItems } from "@/lib/content";
import { answerText } from "@/lib/grading";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPES = [
  { value: "", label: "All formats" },
  { value: "mcq", label: "Multiple choice" },
  { value: "multi", label: "Select all" },
  { value: "predict", label: "Predict output" },
  { value: "fill", label: "Fill blanks" },
  { value: "order", label: "Ordering" },
  { value: "code", label: "Write code" },
  { value: "explain", label: "Explain" },
];

type SearchParams = Promise<{
  q?: string;
  track?: string;
  type?: string;
  saved?: string;
}>;

/**
 * Browse every question with its answer visible.
 *
 * Deliberately separate from the drill: this is for reading and revising the
 * night before an interview, where hiding the answers would just be friction.
 */
export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const tracks = getTracks();
  const savedIds = getSavedItemIds(DEFAULT_USER_ID);

  const items = searchItems(DEFAULT_USER_ID, {
    search: filters.q,
    trackSlug: filters.track,
    type: filters.type,
    savedOnly: filters.saved === "1",
    limit: 60,
  });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/library?${query}` : "/library";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm ink-muted mt-1">
          Every question with its answer and explanation. For revising, not for testing yourself —
          the drill is where you find out what you actually know.
        </p>
      </header>

      {/* Filters — plain GET form so it works without client JS */}
      <Card className="space-y-3">
        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search questions, code and tags…"
            className="flex-1 min-w-[12rem] rounded-lg border hairline bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--ink-muted)]"
          />
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="rounded-lg border hairline bg-[var(--surface)] px-3 py-2 text-sm"
          >
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {filters.track && <input type="hidden" name="track" value={filters.track} />}
          {filters.saved && <input type="hidden" name="saved" value={filters.saved} />}
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip href={buildHref({ track: undefined })} active={!filters.track}>
            All tracks
          </FilterChip>
          {tracks.map((track) => (
            <FilterChip
              key={track.id}
              href={buildHref({ track: track.slug })}
              active={filters.track === track.slug}
            >
              {track.name}
            </FilterChip>
          ))}
          <FilterChip
            href={buildHref({ saved: filters.saved === "1" ? undefined : "1" })}
            active={filters.saved === "1"}
          >
            ★ Saved
          </FilterChip>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nothing matched"
          body="Try a broader search, or clear the filters."
        />
      ) : (
        <>
          <p className="text-xs ink-muted">
            {items.length} question{items.length === 1 ? "" : "s"}
            {items.length === 60 && " (showing the first 60 — narrow the search for more)"}
          </p>

          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/learn/${item.trackSlug}/${item.moduleSlug}`}
                    className="text-[11px] font-medium hover:underline"
                  >
                    {item.trackName}
                  </Link>
                  <span className="text-[11px] ink-muted">· {item.moduleName}</span>
                  {savedIds.has(item.id) && <Badge variant="warning">★ Saved</Badge>}
                  {item.frequency === 3 && <Badge variant="info">Asked often</Badge>}
                  <span className="ml-auto text-[11px] ink-muted">
                    {TYPES.find((t) => t.value === item.type)?.label}
                  </span>
                </div>

                <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                  {item.prompt}
                </p>

                {item.code && <CodeBlock code={item.code} language={item.language} />}

                {/* <details> keeps the answer one click away without any JS */}
                <details className="group">
                  <summary className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:underline list-none">
                    <span className="group-open:hidden">Show answer</span>
                    <span className="hidden group-open:inline">Hide answer</span>
                  </summary>

                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3">
                      <pre className="snippet whitespace-pre-wrap">{answerText(item)}</pre>
                    </div>
                    <Prose text={item.explanation} language={item.language} />
                    {item.followUp && (
                      <p className="text-xs ink-muted border-l-2 border-indigo-500 pl-3">
                        <span className="font-medium">Follow-up:</span> {item.followUp}
                      </p>
                    )}
                  </div>
                </details>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Link key={tag} href={buildHref({ q: tag })}>
                        <Badge variant="outline">{tag}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1 rounded-md text-[11px] border transition-colors",
        active
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 font-medium"
          : "hairline ink-muted hover:text-[var(--ink)]"
      )}
    >
      {children}
    </Link>
  );
}
