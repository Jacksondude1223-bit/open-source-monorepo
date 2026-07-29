/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export interface ErrorViewProps {
  /** HTTP-style status code to display. Defaults to 500. */
  statusCode?: number;
  /** Large heading shown to the user. */
  title?: string;
  /** Short, user-friendly explanation. */
  message?: string;
  /**
   * Raw error details (message + stack, request id, etc.). When provided, a
   * collapsible "error details" section is rendered. Kept hidden by default.
   */
  details?: string | null;
  /** Whether the details section starts expanded. Defaults to false. */
  defaultExpanded?: boolean;
  /** Optional retry handler. When provided, a "Try again" button is shown. */
  onRetry?: () => void;
  /**
   * When false, the error is not forwarded to the internal reporting webhook.
   * Defaults to true. Set false for expected/handled states that reuse this view.
   */
  report?: boolean;
  /**
   * Full error context (stack, component stack) sent to the reporting webhook.
   * Falls back to `details`. Use this to report the real stack in production
   * while only displaying `details` to users in development.
   */
  reportDetails?: string | null;
}

// Stable, cheap hash so identical errors collapse to one key for dedupe.
function hashSignature(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

// Report an error to the internal webhook proxy at most once per signature per
// browser session, so reloads and re-renders don't spam the channel.
function reportError(args: {
  statusCode: number;
  message: string;
  details?: string | null;
}): void {
  if (typeof window === 'undefined') return;

  const url = window.location?.href ?? 'unknown';
  const signature = hashSignature(`${url}::${args.message}`);
  const storageKey = `__ra_err_reported_${signature}`;

  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // sessionStorage may be unavailable (private mode); fall through and report.
  }

  void fetch('/api/report-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      statusCode: args.statusCode,
      message: args.message,
      stack: args.details ?? '',
      url,
    }),
    keepalive: true,
  }).catch(() => {
    // Reporting is best-effort; never let it surface to the user.
  });
}

/**
 * Self-contained error screen. Intentionally avoids workspace/user context and
 * shared form components so it can render even when the surrounding app tree has
 * crashed (e.g. inside an error boundary or Next.js custom error page).
 */
export default function ErrorView({
  statusCode = 500,
  title = 'Something went wrong',
  message = 'An unexpected error occurred on our end. The issue has been logged — please try again in a moment.',
  details,
  defaultExpanded = false,
  onRetry,
  report = true,
  reportDetails,
}: ErrorViewProps) {
  const [showDetails, setShowDetails] = useState<boolean>(defaultExpanded);
  const hasDetails = typeof details === 'string' && details.trim().length > 0;
  const hasReported = useRef(false);

  useEffect(() => {
    if (!report || hasReported.current) return;
    hasReported.current = true;
    reportError({
      statusCode,
      message: title && title !== 'Something went wrong' ? `${title}: ${message}` : message,
      details: reportDetails ?? details,
    });
    // Only report once on mount for this error instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col bg-white dark:bg-gray-900">
      <main className="mx-auto flex w-full max-w-2xl grow flex-col justify-center px-6 py-16 lg:px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-blue-600 dark:text-blue-400">{statusCode}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-gray-500 dark:text-gray-400">
            {message}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Try again
              </button>
            )}
            <Link
              href="/"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Go back home
            </Link>
          </div>
        </div>

        {hasDetails && (
          <div className="mx-auto mt-8 w-full">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {showDetails ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              {showDetails ? 'Hide error details' : 'Show error details'}
            </button>

            {showDetails && (
              <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-4 text-left text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {details}
              </pre>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
