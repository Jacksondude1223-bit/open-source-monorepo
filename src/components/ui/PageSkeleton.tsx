import { JSX } from 'react';

type PageSkeletonProps = {
  /** Number of large card placeholders to show in a responsive grid (e.g. game cards). */
  cards?: number;
  /** Number of stacked content sections (header + body) to render below the cards. */
  sections?: number;
  /** Optional wrapper classes (margins/padding) controlled by the caller. */
  className?: string;
};

/**
 * A polished, layout-aware loading placeholder for full pages. Unlike
 * `LoadingPage` (a centered spinner used in small/non-page contexts), this
 * mirrors the shape of page content so the real content fades in over the
 * skeleton instead of popping in after a blank spinner.
 */
export default function PageSkeleton({ cards = 0, sections = 1, className = '' }: PageSkeletonProps): JSX.Element {
  return (
    <div role="status" aria-label="Loading" className={`animate-in fade-in duration-500 ${className}`}>
      {cards > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div
              key={i}
              className="aspect-video h-50 max-h-75 w-full animate-pulse rounded-xl border border-gray-100 bg-gray-200/70 dark:border-gray-800 dark:bg-gray-800"
            />
          ))}
        </div>
      )}

      <div className={`flex flex-col gap-8 ${cards > 0 ? 'mt-8' : ''}`}>
        {Array.from({ length: sections }).map((_, s) => (
          <div key={s} className="flex animate-pulse flex-col gap-3">
            <div className="h-5 w-40 rounded-md bg-gray-200/80 dark:bg-gray-700/60" />
            <div className="h-28 w-full rounded-xl bg-gray-200/60 dark:bg-gray-800/60" />
            <div className="h-3 w-3/4 rounded-full bg-gray-200/80 dark:bg-gray-700/60" />
            <div className="h-3 w-2/3 rounded-full bg-gray-200/80 dark:bg-gray-700/60" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
