/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ReactElement } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { trpc } from '~/utils/trpc';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  reviewing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  accepted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  withdrawn: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
};

export default function MyApplicationsPage() {
  const { data, isLoading, refetch } = trpc.postings.getMyApplications.useQuery();
  const withdraw = trpc.postings.withdraw.useMutation({
    onSuccess: () => {
      toast.success('Application withdrawn');
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <LoadingPage />;

  return (
    <>
      <PageHeading
        title="Job Applications"
        description="Track applications you've submitted to staff postings."
      />

      {!data || data.length === 0 ? (
        <div className="mt-8 text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 mb-4">You haven&apos;t applied to any postings yet.</p>
          <Link
            href="/postings"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Browse postings
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {data.map((a) => (
            <div
              key={a._id?.toString()}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
            >
              <div className="flex items-start gap-3">
                {a.posting?.groupIconUrl ? (
                  <img src={a.posting.groupIconUrl} alt="" className="h-10 w-10 rounded-full bg-gray-200" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                )}
                <div className="flex-1 min-w-0">
                  {a.posting ? (
                    <Link
                      href={`/postings/${a.posting.groupId}/${a.jobId}`}
                      className="font-semibold hover:underline"
                    >
                      {a.posting.title}
                    </Link>
                  ) : (
                    <div className="font-semibold text-gray-500">(Posting unavailable)</div>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {a.posting?.groupName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Applied {new Date(a.createdAt).toLocaleDateString()} · via{' '}
                    {a.submissionType.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[a.status] || ''}`}
                  >
                    {a.status}
                  </span>
                  {(a.status === 'pending' || a.status === 'reviewing') && (
                    <button
                      onClick={() => {
                        if (confirm('Withdraw this application?')) {
                          withdraw.mutate({ applicationId: a._id!.toString() });
                        }
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

MyApplicationsPage.getLayout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>;
