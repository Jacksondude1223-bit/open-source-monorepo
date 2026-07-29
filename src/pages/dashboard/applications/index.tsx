/* eslint-disable @next/next/no-img-element */
import { ReactElement } from 'react';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import Link from 'next/link';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  reported: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  passed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  failed: 'Failed',
  reported: 'Reported',
  passed: 'Passed',
};

export default function DashboardPage() {
  const info = useUser();

  const { data: previousResponses, isPending } = trpc.user.previousApplications.useQuery();

  if ('loading' in info || isPending) {
    return <LoadingPage />;
  }

  const responses = previousResponses ?? [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Your Submissions"
        description="Every form application you've submitted across all groups."
      />

      {responses.length === 0 ? (
        <div className="fade-in animate-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800/40">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <ClipboardDocumentCheckIcon className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            No submissions yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            When you apply to a group form, your submissions and results will appear here.
          </p>
        </div>
      ) : (
        <div className="fade-in animate-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th scope="col" className="px-4 py-3 text-center">#</th>
                  <th scope="col" className="px-4 py-3">Group</th>
                  <th scope="col" className="px-4 py-3">Form</th>
                  <th scope="col" className="px-4 py-3">Score</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {responses.map((response, i) => (
                  <tr
                    key={response?.id?.toString()}
                    className="transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-500/5"
                  >
                    <td className="px-4 py-3 text-center text-gray-400">{(i + 1).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      <Link
                        target="_blank"
                        href={`https://roblox.com/groups/${response.groupId}/link`}
                        className="transition hover:text-blue-500"
                      >
                        {response.group}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{response.application}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {response?.score && response?.score?.toString() !== 'NaN' ? `${response.score}%` : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex min-w-20 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[response.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {STATUS_LABELS[response.status] ?? response.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(response.created).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);
