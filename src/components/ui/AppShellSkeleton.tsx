import { JSX } from 'react';

/**
 * A full-app loading placeholder that mirrors the real `AuthedLayout` chrome:
 * a colored sidebar rail with nav placeholders on the left and a content
 * skeleton on the right. Used while the user/session is still resolving so the
 * app fades in over a familiar shape instead of blinking a centered spinner
 * and then popping the whole layout into place.
 */
export default function AppShellSkeleton(): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen animate-in fade-in duration-500 bg-white dark:bg-gray-900"
    >
      {/* Desktop sidebar rail */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto bg-gray-200 px-6 dark:bg-gray-800">
          <div className="flex h-16 shrink-0 items-center">
            <div className="h-8 w-8 animate-pulse rounded-md bg-gray-300/80 dark:bg-gray-700" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md p-2">
                <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-gray-300/80 dark:bg-gray-700" />
                <div
                  className="h-3 animate-pulse rounded-full bg-gray-300/80 dark:bg-gray-700"
                  style={{ width: `${55 + ((i * 7) % 35)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-x-6 bg-gray-200 px-4 py-4 dark:bg-gray-800 lg:hidden">
        <div className="h-6 w-6 animate-pulse rounded bg-gray-300/80 dark:bg-gray-700" />
        <div className="flex-1" />
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-300/80 dark:bg-gray-700" />
      </div>

      {/* Main content */}
      <main className="py-10 lg:pl-72">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            <div className="flex animate-pulse flex-col gap-3">
              <div className="h-6 w-56 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-80 max-w-full rounded-full bg-gray-200/80 dark:bg-gray-800/80" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-gray-100 bg-gray-200/70 dark:border-gray-800 dark:bg-gray-800"
                />
              ))}
            </div>
            <div className="flex animate-pulse flex-col gap-3">
              <div className="h-28 w-full rounded-xl bg-gray-200/60 dark:bg-gray-800/60" />
              <div className="h-3 w-3/4 rounded-full bg-gray-200/80 dark:bg-gray-800/80" />
              <div className="h-3 w-2/3 rounded-full bg-gray-200/80 dark:bg-gray-800/80" />
            </div>
          </div>
        </div>
      </main>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
