import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";
import type { Language } from "@/types";

/**
 * Renders explanation text.
 *
 * Content is authored as light markdown — blank-line paragraphs, fenced code
 * blocks and `inline code`. That's the whole subset, so a full markdown parser
 * would be several times the size of what it renders.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="snippet rounded bg-[var(--surface-muted)] border hairline px-1 py-[1px] text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function Prose({
  text,
  language = "js",
  className,
}: {
  text: string;
  /** Language for fenced blocks that don't declare one. */
  language?: Language;
  className?: string;
}) {
  if (!text?.trim()) return null;

  // Split on fences, keeping them: odd indices are code, even are prose.
  const segments = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const blocks: React.ReactNode[] = [];

  for (let i = 0; i < segments.length; ) {
    const prose = segments[i];
    if (prose?.trim()) {
      prose
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .forEach((paragraph, pIndex) => {
          blocks.push(
            <p key={`p-${i}-${pIndex}`} className="leading-relaxed">
              {renderInline(paragraph.trim(), `p-${i}-${pIndex}`)}
            </p>
          );
        });
    }

    // A fence contributes two capture groups after the prose segment.
    const lang = segments[i + 1];
    const code = segments[i + 2];
    if (code !== undefined) {
      blocks.push(
        <CodeBlock
          key={`c-${i}`}
          code={code.replace(/\n$/, "")}
          language={(lang || language) as Language}
        />
      );
      i += 3;
    } else {
      i += 1;
    }
  }

  return <div className={cn("space-y-3 text-sm", className)}>{blocks}</div>;
}
