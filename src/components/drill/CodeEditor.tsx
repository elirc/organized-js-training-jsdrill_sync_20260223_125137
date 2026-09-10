"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Fires on Cmd/Ctrl+Enter — the run shortcut. */
  onRun?: () => void;
  readOnly?: boolean;
};

/**
 * CodeMirror wrapper.
 *
 * The editor is created once per mount and never rebuilt from `value`: doing
 * that on every keystroke would destroy the cursor position. The runner
 * remounts it with a `key` when the item changes, which is the clean way to
 * reset it.
 */
export function CodeEditor({ value, onChange, onRun, readOnly = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // Keep the latest callbacks reachable without re-creating the editor.
  const handlers = useRef({ onChange, onRun });
  handlers.current = { onChange, onRun };

  useEffect(() => {
    if (!host.current) return;

    const isDark = document.documentElement.classList.contains("dark");

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        closeBrackets(),
        javascript(),
        indentUnit.of("  "),
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              handlers.current.onRun?.();
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        ...(isDark ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle)]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { fontSize: "13px", backgroundColor: isDark ? "#0d131f" : "#ffffff" },
          ".cm-content": { minHeight: "180px", padding: "10px 0" },
          ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
            opacity: "0.5",
          },
          ".cm-activeLine": { backgroundColor: isDark ? "#ffffff08" : "#0f172a06" },
          ".cm-activeLineGutter": { backgroundColor: "transparent" },
        }),
        EditorState.readOnly.of(readOnly),
      ],
    });

    view.current = new EditorView({ state, parent: host.current });

    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // `value` is the initial document only — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  return (
    <div
      ref={host}
      className="rounded-lg border hairline overflow-hidden min-h-[180px] bg-[var(--surface-muted)]"
    />
  );
}
