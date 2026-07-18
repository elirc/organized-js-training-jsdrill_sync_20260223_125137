# Training Doc: Code Editor Component (`src/components/drill/CodeEditor.tsx`)

## Purpose
This component wraps **CodeMirror 6** — a powerful, extensible code editor — into a React component. It provides the coding interface where users write their solutions, complete with syntax highlighting, line numbers, bracket matching, and undo/redo support. Understanding this file teaches how to integrate complex third-party libraries into React.

## Prerequisites
- React hooks (`useEffect`, `useRef`, `useCallback`)
- Understanding of imperative vs declarative programming (React is declarative; CodeMirror is imperative)
- Basic concept of editor extensions (plugins that add functionality)

---

## Line-by-Line Walkthrough of Key Code

### Lines 1–10 — Imports
```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
```
**Why this matters:** CodeMirror 6 is **modular by design**. Unlike CodeMirror 5 or Monaco (which ship everything), CM6 requires you to import exactly the features you need. This keeps bundle size small (~150KB vs Monaco's 2-4MB). Each import serves a specific purpose:

- **`EditorState`** — The immutable data model representing the editor's content and configuration.
- **`EditorView`** — The DOM rendering layer that displays the editor.
- **`javascript()`** — JavaScript language support (syntax highlighting, parsing).
- **`oneDark`** — A dark theme (similar to VS Code's One Dark Pro).
- **`history()`** — Enables undo/redo (Ctrl+Z / Ctrl+Shift+Z).
- **`bracketMatching()`** — Highlights matching brackets when cursor is adjacent.
- **`closeBrackets()`** — Auto-inserts closing brackets/quotes.

---

### Lines 12–16 — Props Type
```typescript
type CodeEditorProps = {
  initialCode: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
};
```
**Why this matters:** The component receives:
- **`initialCode`** — The starter code to pre-populate (from the problem's `starterCode` field).
- **`onChange`** — A callback that fires whenever the user types, passing the full current code. This is how the parent component (drill page) tracks the code state.
- **`readOnly?`** — Optional flag for display-only mode (e.g., showing the solution).

---

### Lines 18–23 — Refs for Imperative Control
```typescript
export function CodeEditor({ initialCode, onChange, readOnly = false }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
```
**Why this matters:** This is the **bridge between React's declarative world and CodeMirror's imperative API**:

- **`editorRef`** — A ref to the DOM `<div>` where CodeMirror will mount. React creates the div, and we give CodeMirror a reference to it.
- **`viewRef`** — Stores the CodeMirror `EditorView` instance so we can destroy it on cleanup.
- **`onChangeRef`** — This is a critical pattern. The `onChange` callback from props might change every render (if the parent doesn't memoize it). If we used `onChange` directly in the CodeMirror listener, we'd either:
  - Re-create the editor every time `onChange` changes (expensive), or
  - Use a stale version of `onChange` (buggy)

  By storing it in a ref (`onChangeRef.current = onChange`), we always call the latest version without needing to re-create the editor. This is called the **callback ref pattern**.

---

### Lines 25–76 — `createEditor` (THE CORE SETUP)
```typescript
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
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": { fontSize: "14px", height: "100%" },
        ".cm-scroller": {
          fontFamily: "var(--font-geist-mono), 'Fira Code', 'Consolas', monospace",
        },
        ".cm-content": { minHeight: "200px" },
      }),
      ...(readOnly ? [EditorState.readOnly.of(true)] : []),
    ],
  });

  viewRef.current = new EditorView({
    state,
    parent: editorRef.current,
  });
}, [initialCode, readOnly]);
```
**Why this matters:** Let's break down the most important parts:

**Cleanup before create (lines 29-31):**
```typescript
if (viewRef.current) {
  viewRef.current.destroy();
}
```
If an editor already exists (e.g., when `initialCode` changes between problems), we destroy it first to prevent memory leaks and duplicate editors.

**Extensions array — the feature system:**
Every feature of the editor is an "extension." They're composed into an array:
- `lineNumbers()` — Displays line numbers in the gutter
- `highlightActiveLine()` — Highlights the line the cursor is on
- `history()` — Enables undo/redo functionality
- `javascript()` — Parses JavaScript for syntax highlighting and indentation
- `oneDark` — The color theme

**Keymap composition (lines 45-50):**
```typescript
keymap.of([
  ...defaultKeymap,      // Standard text editing keys
  ...historyKeymap,      // Ctrl+Z, Ctrl+Shift+Z
  ...closeBracketsKeymap, // Bracket auto-close keybindings
  indentWithTab,         // Tab key inserts indentation (not move focus)
]),
```
Multiple keymaps are spread into a single array, giving the editor all key bindings at once.

**The change listener (lines 51-55):**
```typescript
EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    onChangeRef.current(update.state.doc.toString());
  }
}),
```
This extension fires on every editor update. We check `update.docChanged` to only notify the parent when the actual text changed (not on cursor movements or selection changes). `update.state.doc.toString()` converts the editor's internal document model to a plain string.

**Conditional readOnly (line 68):**
```typescript
...(readOnly ? [EditorState.readOnly.of(true)] : []),
```
This is a **conditional extension pattern**: if `readOnly` is true, we spread in a one-element array containing the readOnly extension. If false, we spread an empty array (adding nothing). This is cleaner than an `if` statement.

---

### Lines 78–86 — Lifecycle Management
```typescript
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
**Why this matters:** The effect creates the editor on mount and destroys it on unmount:
- **`createEditor`** is in the dependency array, which depends on `[initialCode, readOnly]`. So the editor is re-created when the problem changes (new `initialCode`) or when readOnly toggles.
- **The cleanup function** (`return () => { ... }`) runs before re-creation and on unmount, preventing memory leaks. `viewRef.current = null` ensures we don't hold a reference to a destroyed editor.

---

### Lines 88–93 — Render
```typescript
return (
  <div
    ref={editorRef}
    className="rounded-lg overflow-hidden border border-gray-700 min-h-[200px]"
  />
);
```
**Why this matters:** The entire render is just a styled `<div>`. CodeMirror takes over this div and renders the editor inside it. The `ref={editorRef}` connects the React ref to the DOM element so `createEditor` can find it. The `min-h-[200px]` ensures the editor has a minimum height even before CodeMirror mounts.

---

## How This File Connects to the Rest of the App
- **Used by** the drill page (`app/app/page.tsx`) for the coding phase
- **Receives** `initialCode` (problem's starter code) and `onChange` (to update the code state)
- **The code state** is later passed to `executeUserCode()` in the executor
- **Could also be used** by the ProblemForm for editing solution code (with `readOnly`)

## Key Takeaways
1. CodeMirror 6 is modular — you import only what you need
2. The callback ref pattern (`onChangeRef`) bridges React reactivity with imperative APIs
3. Extensions are the feature system — everything from line numbers to syntax highlighting is an extension
4. Always cleanup imperative resources (`.destroy()`) in React effect cleanup functions
5. Conditional extensions use the spread-empty-array pattern
