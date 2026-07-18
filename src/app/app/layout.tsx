import Link from "next/link";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            Reps
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/app"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Practice
            </Link>
            <Link
              href="/app/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/app/patterns"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Patterns
            </Link>
            <Link
              href="/admin"
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
