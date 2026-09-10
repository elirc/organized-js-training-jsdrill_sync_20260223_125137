"use client";

import { useState } from "react";
import { CodeEditor } from "./CodeEditor";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Button, Kbd } from "@/components/ui";
import { errorHint } from "@/lib/executor";
import { cn } from "@/lib/utils";
import type { DrillItem, ExecutionResult, Grade, Response } from "@/types";

type Props = {
  item: DrillItem;
  response: Response | null;
  onChange: (response: Response) => void;
  onRun: () => void;
  running: boolean;
  execution: ExecutionResult | null;
  grade: Grade | null;
};

export function CodeView({ item, response, onChange, onRun, running, execution, grade }: Props) {
  const [showSolution, setShowSolution] = useState(false);
  const code = response?.kind === "code" ? response.code : item.starterCode;

  return (
    <div className="space-y-3">
      <CodeEditor
        key={item.id}
        value={code}
        readOnly={Boolean(grade)}
        onChange={(next) => onChange({ kind: "code", code: next })}
        onRun={onRun}
      />

      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={running || Boolean(grade)}>
          {running ? "Running…" : "Run tests"}
        </Button>
        <span className="text-xs ink-muted flex items-center gap-1.5">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </span>
        {grade && (
          <button
            type="button"
            onClick={() => setShowSolution((s) => !s)}
            className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showSolution ? "Hide" : "Show"} a working solution
          </button>
        )}
      </div>

      {execution && <TestResults execution={execution} />}

      {showSolution && item.solutionCode && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide ink-muted mb-1.5">
            One way to write it
          </p>
          <CodeBlock code={item.solutionCode} language={item.language} />
        </div>
      )}
    </div>
  );
}

function TestResults({ execution }: { execution: ExecutionResult }) {
  const passed = execution.results.filter((r) => r.passed).length;
  const total = execution.results.length;
  const hint = errorHint(execution.errorType);

  return (
    <div className="rounded-lg border hairline overflow-hidden">
      <div
        className={cn(
          "px-3.5 py-2 text-xs font-medium flex items-center justify-between",
          execution.allPassed
            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
        )}
      >
        <span>
          {passed}/{total} tests passing
        </span>
        {execution.allPassed && <span>All green</span>}
      </div>

      {hint && !execution.allPassed && (
        <p className="px-3.5 py-2 text-xs ink-muted border-b hairline">{hint}</p>
      )}

      <ul className="divide-y hairline">
        {execution.results.map((result, i) => (
          <li key={i} className="px-3.5 py-2.5 text-xs">
            <div className="flex items-start gap-2">
              <span className={result.passed ? "text-emerald-600" : "text-rose-600"}>
                {result.passed ? "✓" : "✕"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={result.passed ? "ink-muted" : ""}>{result.testCase.description}</p>
                {!result.passed && (
                  <div className="mt-1.5 space-y-0.5 snippet">
                    {result.error ? (
                      <p className="text-rose-600 dark:text-rose-400">{result.error}</p>
                    ) : (
                      <>
                        <p className="ink-muted">
                          expected <span className="text-emerald-600 dark:text-emerald-400">{String(result.expected)}</span>
                        </p>
                        <p className="ink-muted">
                          received <span className="text-rose-600 dark:text-rose-400">{String(result.result)}</span>
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {execution.logs.length > 0 && (
        <div className="px-3.5 py-2.5 border-t hairline bg-[var(--surface-muted)]">
          <p className="text-[11px] font-medium uppercase tracking-wide ink-muted mb-1">Console</p>
          <pre className="snippet whitespace-pre-wrap">{execution.logs.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}
