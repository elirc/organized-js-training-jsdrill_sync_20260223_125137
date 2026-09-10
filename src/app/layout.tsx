import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ramp — from beginner to mid-level web developer",
  description:
    "Interview-focused practice for the JavaScript, TypeScript, React, Node, C# and .NET stack. Real questions, spaced repetition, no algorithm puzzles.",
};

/**
 * Applies the saved theme before first paint. Inlined and render-blocking on
 * purpose — a `useEffect` would run after hydration and flash the wrong theme.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem('ramp-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (saved !== 'light' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
