# `src/app/app/layout.tsx` — App Shell Layout

**What this file does:** Wraps all pages under `/app/*` with a sticky navigation bar and consistent content container. This is the "chrome" around every user-facing page (practice, dashboard, patterns).

**Why it matters:** Layout files in Next.js App Router are a powerful architectural pattern. This one demonstrates nested layouts, shared navigation, and content width management — concepts that scale to much larger applications.

---

## How Next.js Layouts Work

In the App Router, `layout.tsx` files wrap all pages in their directory and subdirectories. The nesting:

```
src/app/layout.tsx          ← Root layout (html, body, fonts)
  src/app/app/layout.tsx    ← This file (nav bar, content container)
    src/app/app/page.tsx    ← Drill page
    src/app/app/dashboard/page.tsx
    src/app/app/patterns/page.tsx
```

When you navigate from `/app` to `/app/dashboard`, the root layout and app layout **don't re-render**. Only the `page.tsx` content swaps. This means:
- The nav bar doesn't flicker during navigation
- Any state in the layout persists across page changes
- The browser doesn't re-download shared CSS/JS

This is similar to a "shell" in single-page apps, but server-rendered.

---

## The Navigation Bar

```tsx
<nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
  <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
    <Link href="/" className="text-xl font-bold text-indigo-600">
      Reps
    </Link>
    <div className="flex items-center gap-6">
      <Link href="/app">Practice</Link>
      <Link href="/app/dashboard">Dashboard</Link>
      <Link href="/app/patterns">Patterns</Link>
      <Link href="/admin">Admin</Link>
    </div>
  </div>
</nav>
```

Key CSS decisions:
- **`sticky top-0`** — The nav stays visible as you scroll. `sticky` (vs `fixed`) still takes up space in the document flow, so content doesn't get hidden behind it.
- **`z-50`** — Ensures the nav sits above other content. CodeMirror's editor and dropdown menus might have their own z-index values; `z-50` keeps the nav on top.
- **`max-w-4xl mx-auto`** — Content maxes out at 896px width, centered. This prevents uncomfortably wide text on large monitors. The same constraint is applied to the main content area.

### The Admin Link Styling

```tsx
<Link
  href="/admin"
  className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
>
  Admin
</Link>
```

The Admin link is intentionally de-emphasized — `text-gray-400` instead of `text-gray-600`. It's a secondary action that most users won't need during a drill session. This is a **visual hierarchy** choice: primary nav items (Practice, Dashboard, Patterns) are darker, the utility link (Admin) is lighter.

---

## The Content Container

```tsx
<main className="flex-1">
  <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
</main>
```

- **`flex-1`** on `<main>` makes it expand to fill available vertical space (the parent is `min-h-screen flex flex-col`). This pushes any footer to the bottom of the viewport.
- **`max-w-4xl mx-auto px-4 py-6`** matches the nav's width constraint, providing consistent alignment. The `px-4` padding prevents content from touching screen edges on mobile.
- **`{children}`** is where the current page renders. React's `children` prop is how layouts receive page content in Next.js.

---

## Why a Separate Layout from Admin?

The admin section (`/admin/*`) has its own layout with different navigation. Keeping them separate means:
- Admin pages could have a different nav structure (e.g., sidebar)
- The user-facing app stays clean and focused
- Future auth could protect `/admin` separately

---

## Server vs Client Component

Notice this layout has **no** `"use client"` directive. It's a **Server Component** by default. This means:
- It renders on the server (zero JavaScript shipped to the client for this file)
- The `Link` components still work for client-side navigation (Next.js handles this)
- The nav bar HTML is included in the initial page load (no flash of unstyled content)

If we needed interactivity in the nav (e.g., a mobile hamburger menu, active link highlighting), we'd add `"use client"`. But for static navigation links, a server component is optimal.
