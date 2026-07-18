# `src/components/drill/ApproachPrompt.tsx` — Approach Step Gate

**What this file does:** Renders a textarea that forces the user to describe their approach (minimum 10 characters) before they can access the code editor. It's the "think before you code" gate.

**Why it matters:** This small component enforces the app's core learning philosophy. Interview prep research consistently shows that candidates who verbalize their approach before coding perform better. This component makes that habit non-negotiable.

---

## The 10-Character Gate

```ts
const handleSubmit = () => {
  if (text.trim().length < 10) return;
  onSubmit(text.trim());
};
```

Why 10 characters? It's the minimum to express a meaningful thought — "sort array" is 10 characters. Shorter than that and you're probably just typing "ok" to skip the step. Longer minimums (like 50 characters) would feel punitive and incentivize padding ("I will try to solve this problem by...").

The `.trim()` prevents gaming with spaces: "          " (10 spaces) won't pass.

---

## Real-Time Feedback

```tsx
<span className="text-xs text-gray-400">
  {text.trim().length < 10
    ? `${10 - text.trim().length} more characters needed`
    : "Ready to code"}
</span>
<Button
  onClick={handleSubmit}
  disabled={text.trim().length < 10}
  size="sm"
>
  Unlock Editor →
</Button>
```

Two feedback mechanisms:
1. **Counter text** — "7 more characters needed" gives precise progress. It switches to "Ready to code" when the threshold is met.
2. **Disabled button** — visually grayed out until 10 characters. The `disabled` prop prevents clicks AND applies a visual style (via CSS in the Button component).

This is **progressive disclosure**: the next action (coding) is revealed only after completing the current step (planning).

---

## The Instructional Copy

```tsx
<p className="text-xs text-gray-500">
  In 1-2 sentences, describe how you plan to solve this. This builds the
  think-first habit that separates strong candidates in interviews.
</p>
```

The copy explains *why* the step exists, not just what to do. "This builds the think-first habit that separates strong candidates" motivates compliance. Without the explanation, users would resent the friction.

---

## Component Simplicity

The entire component is 53 lines — one piece of state, one callback, one render. This is intentional. Approach entry is a simple interaction: type text, hit submit. Any additional complexity (rich text, auto-save, word count, etc.) would distract from the purpose: get the user to *think* for 10 seconds before coding.

The `autoFocus` on the textarea means the cursor is already in the text field when the component renders. One less click.

---

## The `onSubmit` Callback

```ts
type ApproachPromptProps = {
  onSubmit: (text: string) => void;
};
```

The parent (`DrillPage`) passes a callback that stores the approach text and transitions to the coding phase:

```ts
const handleApproachSubmit = (text: string) => {
  setApproachText(text);
  setPhase("coding");
};
```

This keeps `ApproachPrompt` as a presentational component — it doesn't know about phases or state machines. It just says "the user submitted this text" and lets the parent decide what happens next.
