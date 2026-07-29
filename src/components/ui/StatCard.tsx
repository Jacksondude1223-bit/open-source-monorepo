import { JSX, ReactNode } from 'react';

export type StatAccent = 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'gray' | 'cyan';

const accentStyles: Record<StatAccent, { icon: string; ring: string; bar: string }> = {
  blue: {
    icon: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400',
    ring: 'hover:border-blue-300 dark:hover:border-blue-700/60',
    bar: 'bg-blue-500',
  },
  green: {
    icon: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400',
    ring: 'hover:border-emerald-300 dark:hover:border-emerald-700/60',
    bar: 'bg-emerald-500',
  },
  amber: {
    icon: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400',
    ring: 'hover:border-amber-300 dark:hover:border-amber-700/60',
    bar: 'bg-amber-500',
  },
  violet: {
    icon: 'text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400',
    ring: 'hover:border-violet-300 dark:hover:border-violet-700/60',
    bar: 'bg-violet-500',
  },
  rose: {
    icon: 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400',
    ring: 'hover:border-rose-300 dark:hover:border-rose-700/60',
    bar: 'bg-rose-500',
  },
  cyan: {
    icon: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-400',
    ring: 'hover:border-cyan-300 dark:hover:border-cyan-700/60',
    bar: 'bg-cyan-500',
  },
  gray: {
    icon: 'text-gray-600 bg-gray-100 dark:bg-gray-700/40 dark:text-gray-300',
    ring: 'hover:border-gray-300 dark:hover:border-gray-600',
    bar: 'bg-gray-400',
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  hint,
  loading = false,
  className = '',
}: {
  label: string;
  value: ReactNode;
  icon?: any;
  accent?: StatAccent;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}): JSX.Element {
  const styles = accentStyles[accent];

  return (
    <div
      className={`group relative grow basis-40 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 px-4 py-3.5 shadow-sm transition-all duration-200 ${styles.ring} hover:shadow-md ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${styles.bar} opacity-70`} aria-hidden="true" />
      <div className="pl-1">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </p>
          {Icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
        {loading ? (
          <div className="mt-1.5 h-7 w-16 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        ) : (
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {value}
          </p>
        )}
        {hint && !loading && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
        )}
      </div>
    </div>
  );
}
