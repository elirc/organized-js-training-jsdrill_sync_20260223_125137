# `src/components/drill/CodeEditor.tsx` — CodeMirror Wrapper

**What this file does:** Wraps the CodeMirror 6 library to provide a syntax-highlighted JavaScript code editor within the drill page. Handles editor creation, cleanup, and change propagation to React state.

**Why it matters:** This component bridges two very different worlds: CodeMirror's imperative DOM API and React's declarative rendering model. The patterns used here (refs, cleanup, stale closure avoidance) are essential for integrating any non-React library into a React app.

---

## Why CodeMirror 6 Instead of Monaco?

Monaco (the engine behind VS Code) is powerful but weighs 2-4MB. CodeMirror 6 weighs ~150KB with similar features. For a focused coding drill app, we don't need Monaco's multi-cursor editing, IntelliSense, or git integration. CodeMirror gives us syntax highlighting, bracket matching, and undo/redo — everything we need, at a fraction of the bundle size.

---

## The Two Refs

```ts
const editorRef = useRef<HTMLDivElement>(null);
const viewRef = useRef<EditorView | null>(null);
```

**`editorRef`** — Points to the DOM `<div>` where CodeMirror will mount itself. React creates the `<div>`, then we hand it to CodeMirror. This is the standard pattern for integrating non-React libraries: render a container element, then imperatively attach to it.

**`viewRef`** — Holds the CodeMirror `EditorView` instance. We need this to destroy the editor on cleanup. Without it, we'd leak DOM nodes and event listeners.

---

## The `onChangeRef` Pattern (Stale Closure Fix)

```ts
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;
```

This is a critical pattern. Here's the problem it solves:

The `createEditor` function captures `onChange` in its closure when the editor is created. But `onChange` might be a new function reference on every render (e.g., `setCode` from `useState`). If we used `onChange` directly inside the update listener, we'd be calling a stale version from the initial render.

The fix: store `onChange` in a ref that we update every render. Inside the update listener, read from the ref:

```ts
EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    onChangeRef.current(update.state.doc.toString());
  }
}),
```

`onChangeRef.current` always points to the latest `onChange` function, even though the listener was created once.

**This is a React patterns interview question.** If someone asks about stale closures in hooks, this is a perfect real-world example.

---

## Editor Creation

```ts
const createEditor = useCallback(() => {
  if (!editorRef.current) return;

  if (viewRef.current) {
    viewRef.current.destroy();
  }

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      closeBrackets(),
      javascript(),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap,
        indentWithTab,
      ]),
      // ... update listener, theme overrides
    ],
  });

  viewRef.current = new EditorView({
    state,
    parent: editorRef.current,
  });
}, [initialCode, readOnly]);
```

### The Extension Stack

CodeMirror 6 is modular — you compose features as "extensions":

| Extension | What it does |
|---|---|
| `lineNumbers()` | Shows line numbers in the gutter |
| `highlightActiveLine()` | Highlights the line the cursor is on |
| `history()` | Enables undo/redo (Ctrl+Z/Ctrl+Shift+Z) |
| `bracketMatching()` | Highlights matching brackets when cursor is next to one |
| `closeBrackets()` | Auto-inserts closing brackets/quotes |
| `javascript()` | JavaScript syntax highlighting and parsing |
| `oneDark` | Dark theme (matches the coding aesthetic) |
| `indentWithTab` | Tab key inserts indentation instead of moving focus |

### The Keymap

```ts
keymap.of([
  ...defaultKeymap,
  ...historyKeymap,
  ...closeBracketsKeymap,
  indentWithTab,
])
```

Keymaps are layered. `defaultKeymap` provides basic editing (arrows, Enter, Delete). `historyKeymap` adds Ctrl+Z/Y. `closeBracketsKeymap` makes Backspace delete both brackets when you delete an auto-closed pair. `indentWithTab` is added separately because it's opt-in (some apps prefer Tab for focus navigation).

### The Theme Override

```ts
EditorView.theme({
  "&": { fontSize: "14px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono), ..." },
  ".cm-content": { minHeight: "200px" },
}),
```

`"&"` targets the root editor element. These overrides integrate CodeMirror's styling with our app's design system — using the same monospace font family and ensuring a minimum editor height.

---

## Cleanup on Unmount

```ts
useEffect(() => {
  createEditor();
  return () => {
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
  };
}, [createEditor]);
```

The cleanup function (`return () => { ... }`) runs when the component unmounts or when `createEditor` changes (which happens when `initialCode` or `readOnly` changes). `destroy()` removes all DOM nodes and event listeners that CodeMirror created. Setting `viewRef.current = null` is defensive — prevents double-destroy errors.

---

## The ReadOnly Conditional

```ts
...(readOnly ? [EditorState.readOnly.of(true)] : []),
```

The spread into the extensions array conditionally adds the readonly extension. The `...[]` spread of an empty array adds nothing — it's a clean way to conditionally include array items without if/else blocks.
