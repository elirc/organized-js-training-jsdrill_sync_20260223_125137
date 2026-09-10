import type { Level } from "@/types";

export function generateId(): string {
  // crypto.randomUUID exists in Node 18+ and every browser we target.
  return globalThis.crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj).sort();
  const keysB = Object.keys(bObj).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key, i) => key === keysB[i] && deepEqual(aObj[key], bObj[key]));
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function levelLabel(level: Level): string {
  return { foundation: "Foundation", working: "Working", professional: "Professional" }[level];
}

export function levelOrder(level: Level): number {
  return { foundation: 0, working: 1, professional: 2 }[level];
}

/** Fisher–Yates. Returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Local (not UTC) YYYY-MM-DD — the user's "today", not London's. */
export function localDay(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Consecutive days ending today (or yesterday) with at least one attempt. */
export function computeStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  let streak = 0;
  // A streak survives until the end of today, so start from yesterday if
  // today has no activity yet.
  let cursor = days.has(localDay()) ? 0 : 1;
  if (cursor === 1 && !days.has(daysAgo(1))) return 0;
  while (days.has(daysAgo(cursor))) {
    streak++;
    cursor++;
  }
  return streak;
}
