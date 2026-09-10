"use client";

import { cn } from "@/lib/utils";

// ─── Button ───

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/20",
    secondary:
      "surface border text-[var(--ink)] hover:bg-[var(--surface-muted)]",
    ghost: "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    success: "bg-emerald-600 text-white hover:bg-emerald-500",
  };

  const sizes = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3.5 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-lg transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

// ─── Card ───

type CardProps = React.ComponentProps<"div"> & {
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({ padding = "md", className, ...props }: CardProps) {
  const paddings = { none: "", sm: "p-3", md: "p-5", lg: "p-7" };
  return (
    <div
      className={cn("surface border rounded-xl", paddings[padding], className)}
      {...props}
    />
  );
}

// ─── Badge ───

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    error: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    info: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
    outline: "border hairline ink-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Progress bar ───

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  /** 0..1 */
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn("h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", barClassName ?? "bg-indigo-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Keyboard hint ───

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.4rem] h-[1.4rem] px-1 rounded border hairline bg-[var(--surface-muted)] text-[10px] font-mono ink-muted">
      {children}
    </kbd>
  );
}

// ─── Form controls ───

type InputProps = React.ComponentProps<"input"> & { label?: string };

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium ink-muted mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "block w-full rounded-lg border hairline bg-[var(--surface)] px-3 py-2 text-sm",
          "placeholder:text-[var(--ink-muted)] focus:border-indigo-500",
          className
        )}
        {...props}
      />
    </div>
  );
}

type TextareaProps = React.ComponentProps<"textarea"> & { label?: string };

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium ink-muted mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "block w-full rounded-lg border hairline bg-[var(--surface)] px-3 py-2 text-sm",
          "placeholder:text-[var(--ink-muted)] focus:border-indigo-500 resize-y",
          className
        )}
        {...props}
      />
    </div>
  );
}

type SelectProps = React.ComponentProps<"select"> & {
  label?: string;
  options: { value: string; label: string }[];
};

export function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium ink-muted mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "block w-full rounded-lg border hairline bg-[var(--surface)] px-3 py-2 text-sm",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Empty state ───

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card padding="lg" className="text-center">
      {icon && <div className="text-3xl mb-3">{icon}</div>}
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm ink-muted max-w-md mx-auto mb-4">{body}</p>
      {action}
    </Card>
  );
}
