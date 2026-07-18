import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600">Reps</span>
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Practice
            </Link>
            <Link
              href="/app/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 text-center space-y-8">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            Build coding fluency
            <br />
            <span className="text-indigo-600">one rep at a time</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Spaced repetition meets coding practice. Master patterns, not
            problems. Think first, code second. Go from novice to
            interview-ready.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Practicing →
            </Link>
            <Link
              href="/app/dashboard"
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              View Dashboard
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left">
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <div className="text-2xl mb-2">🧠</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Think First
              </h3>
              <p className="text-sm text-gray-600">
                Describe your approach before coding. Build the interview habit
                of planning before implementation.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <div className="text-2xl mb-2">🔄</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Spaced Repetition
              </h3>
              <p className="text-sm text-gray-600">
                The algorithm schedules your reviews at optimal intervals.
                Problems you struggle with come back sooner.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200 bg-white">
              <div className="text-2xl mb-2">🏷️</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Pattern Recognition
              </h3>
              <p className="text-sm text-gray-600">
                Every problem reveals its pattern. Build a mental library of
                reusable approaches, not memorized solutions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
