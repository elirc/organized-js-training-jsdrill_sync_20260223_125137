import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              Reps
            </Link>
            <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600"
            >
              Problems
            </Link>
            <Link
              href="/admin/categories"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600"
            >
              Categories
            </Link>
            <Link
              href="/admin/patterns"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600"
            >
              Patterns
            </Link>
            <Link
              href="/app"
              className="text-sm font-medium text-gray-400 hover:text-gray-600"
            >
              Back to App
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
