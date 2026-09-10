import { cn } from "@/lib/utils";
import type { Language } from "@/types";

/**
 * Read-only snippet rendering with light syntax highlighting.
 *
 * A full highlighter (Shiki, Prism) is a lot of bytes for snippets that are
 * mostly 5–15 lines, so this tokenises the four things that actually aid
 * reading — comments, strings, numbers and keywords — and leaves everything
 * else alone. Tokenising in one pass with a single alternation matters: run
 * separate passes and a keyword inside a string gets coloured.
 */

const KEYWORDS: Record<string, string[]> = {
  js: "const let var function return if else for while of in new class extends super this async await try catch finally throw typeof instanceof null undefined true false import export default from break continue switch case delete void yield static get set".split(
    " "
  ),
  csharp:
    "public private protected internal static void class interface record struct var new return if else for foreach while do switch case break continue try catch finally throw using namespace async await override virtual abstract sealed readonly const this base null true false string int bool double decimal long object dynamic get set partial where select from".split(
      " "
    ),
  sql: "select from where group by having order limit offset join inner left right full outer on as insert into values update set delete create table alter drop index primary key foreign references null not and or distinct count sum avg min max case when then else end over partition asc desc union all exists between like".split(
      " "
    ),
  bash: "git npm npx node dotnet cd ls echo export if then fi for do done sudo curl".split(" "),
  http: "GET POST PUT PATCH DELETE OPTIONS HEAD HTTP".split(" "),
  json: "true false null".split(" "),
  text: [],
};

function keywordsFor(language: Language): Set<string> {
  if (language === "ts" || language === "jsx" || language === "tsx") {
    return new Set([
      ...KEYWORDS.js,
      ..."type interface implements enum namespace declare readonly keyof infer satisfies as is public private protected abstract override unknown never any string number boolean".split(
        " "
      ),
    ]);
  }
  return new Set(KEYWORDS[language] ?? KEYWORDS.js);
}

// Comments and strings first so their contents are never re-tokenised.
const TOKENS = new RegExp(
  [
    "(\\/\\/[^\\n]*|#[^\\n]*|--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)", // 1 comment
    "(`(?:\\\\.|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')", // 2 string
    "\\b(\\d+(?:\\.\\d+)?)\\b", // 3 number
    "([A-Za-z_$][\\w$]*)", // 4 word
  ].join("|"),
  "g"
);

const CLASSES = {
  comment: "text-slate-400 dark:text-slate-500 italic",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  keyword: "text-violet-700 dark:text-violet-300 font-medium",
};

function highlight(code: string, language: Language): React.ReactNode[] {
  const keywords = keywordsFor(language);
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // A fresh regex per call — a shared global regex carries lastIndex between
  // renders and would drop the first token on every other snippet.
  const pattern = new RegExp(TOKENS.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    const [text, comment, string, number, word] = match;

    if (match.index > lastIndex) nodes.push(code.slice(lastIndex, match.index));

    if (comment) nodes.push(<span key={key++} className={CLASSES.comment}>{text}</span>);
    else if (string) nodes.push(<span key={key++} className={CLASSES.string}>{text}</span>);
    else if (number) nodes.push(<span key={key++} className={CLASSES.number}>{text}</span>);
    else if (word && keywords.has(word))
      nodes.push(<span key={key++} className={CLASSES.keyword}>{text}</span>);
    else nodes.push(text);

    lastIndex = match.index + text.length;
  }

  if (lastIndex < code.length) nodes.push(code.slice(lastIndex));
  return nodes;
}

export function CodeBlock({
  code,
  language = "js",
  className,
}: {
  code: string;
  language?: Language;
  className?: string;
}) {
  if (!code.trim()) return null;

  return (
    <pre
      className={cn(
        "snippet overflow-x-auto rounded-lg border hairline bg-[var(--surface-muted)] p-3.5",
        className
      )}
    >
      <code>{highlight(code, language)}</code>
    </pre>
  );
}

/** Inline snippet, for a symbol mentioned in prose. */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="snippet rounded bg-[var(--surface-muted)] border hairline px-1 py-0.5 text-[0.8em]">
      {children}
    </code>
  );
}
