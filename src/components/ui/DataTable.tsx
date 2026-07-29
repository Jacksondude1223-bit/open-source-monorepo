import { ReactNode } from 'react';
import Button from '~/components/forms/Button';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';

/**
 * A typed column definition for {@link DataTable}.
 *
 * - `header` is the column heading text.
 * - `cell` renders a single row's cell for this column.
 * - `width` is an optional Tailwind width class (e.g. `w-24`).
 * - `align` controls horizontal alignment of header + cells.
 * - `className` is applied to every `<td>` for this column.
 */
export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
};

export type DataTablePagination = {
  page: number; // 0-indexed
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

/**
 * A generic, reusable table that matches the app's table styling (sticky header,
 * zebra rows, dark-mode aware). Supports typed columns, skeleton loading rows, an
 * empty state, optional row click, and optional server-side pagination controls.
 */
export default function DataTable<T>({
  columns,
  rows,
  loading = false,
  skeletonRows = 8,
  emptyState = 'Nothing to show yet.',
  rowKey,
  onRowClick,
  pagination,
  className = '',
}: {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: ReactNode;
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  pagination?: DataTablePagination;
  className?: string;
}) {
  const alignClass = (align?: 'left' | 'center' | 'right') =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const isEmpty = !loading && (!rows || rows.length === 0);

  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-3 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 ${alignClass(col.align)} ${col.width || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr
                key={`skeleton-${i}`}
                className={`${i % 2 === 1 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3">
                    <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </td>
                ))}
              </tr>
            ))}

          {isEmpty && (
            <tr>
              <td colSpan={columns.length}>
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyState}
                </div>
              </td>
            </tr>
          )}

          {!loading &&
            rows?.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition ${onRowClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''} ${i % 2 === 1 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 align-middle text-sm ${alignClass(col.align)} ${col.className || ''}`}
                  >
                    {col.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {pagination && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {pagination.total > 0 ? (
              <>
                {pagination.page * pagination.pageSize + 1}
                {'–'}
                {Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total.toLocaleString()}
              </>
            ) : (
              '0 results'
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="pagination"
              icon={ChevronLeftIcon}
              disabled={pagination.page <= 0}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Page {pagination.page + 1} of {Math.max(pagination.totalPages, 1)}
            </span>
            <Button
              variant="pagination"
              icon={ChevronRightIcon}
              disabled={pagination.page >= pagination.totalPages - 1}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
