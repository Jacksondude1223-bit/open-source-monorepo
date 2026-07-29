export default function Badge({ children, color }: { children: React.ReactNode, color: 'blue' | 'green' | 'yellow' | 'red' | 'light' }) {
  return (
    <p
      className={`${{
          blue: 'bg-blue-200 transition dark:bg-blue-800 text-blue-900 dark:text-blue-100',
          green:
            'bg-green-200 transition dark:bg-green-800 text-green-900 dark:text-green-100',
          yellow:
            'bg-yellow-200 transition dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100',
          red: 'bg-red-200 transition dark:bg-red-800 text-red-900 dark:text-red-100',
          light: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline bg-zinc-600/10 text-zinc-700 group-data-hover:bg-zinc-600/20 dark:bg-white/5 dark:text-zinc-400 dark:group-data-hover:bg-white/10',
        }[color] as 'blue' | 'green' | 'yellow' | 'red' | 'light'
        }
px-2 py-1 rounded-lg text-xs font-medium text-center justify-center flex flex-row gap-1 w-min text-nowrap`}
    >
      {children}
    </p>
  );
}
