"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/learn", label: "Roadmap" },
  { href: "/drill", label: "Practice" },
  { href: "/interview", label: "Mock interview" },
  { href: "/library", label: "Library" },
  { href: "/dashboard", label: "Progress" },
];

export function Nav({ dueCount = 0 }: { dueCount?: number }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b hairline bg-[var(--surface)]/85 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight shrink-0">
          Ramp
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto min-w-0">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-[var(--surface-muted)] font-medium"
                    : "ink-muted hover:text-[var(--ink)]"
                )}
              >
                {link.label}
                {link.href === "/drill" && dueCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                    {dueCount > 99 ? "99+" : dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}

/**
 * The current theme lives on <html>, applied by the inline script in the root
 * layout before first paint. That makes the DOM the source of truth rather
 * than React state, so the button subscribes to it instead of mirroring it —
 * which also keeps two toggles on one page in sync.
 */
const themeStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    themeStore.listeners.add(listener);
    return () => themeStore.listeners.delete(listener);
  },
  getSnapshot() {
    return document.documentElement.classList.contains("dark");
  },
  // The server has no <html> class yet; the inline script sets it before
  // hydration, and suppressHydrationWarning on <html> covers the gap.
  getServerSnapshot() {
    return false;
  },
  set(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("ramp-theme", dark ? "dark" : "light");
    } catch {
      // Private mode — the theme just won't persist.
    }
    themeStore.listeners.forEach((listener) => listener());
  },
};

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  );

  const toggle = () => themeStore.set(!dark);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="ml-auto shrink-0 h-8 w-8 rounded-md grid place-items-center ink-muted hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
