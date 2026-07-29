'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import {
  EMPTY_POSTING,
  PostingForm,
  PostingFormValue,
} from '~/components/page_components/workspaces/postings/PostingForm';
import { trpc } from '~/utils/trpc';
import Badge from '~/components/ui/Badge';

const APPLICANT_STATUSES = ['pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'] as const;
type ApplicantStatus = (typeof APPLICANT_STATUSES)[number];

const STATUS_BADGE: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'light'> = {
  pending: 'yellow',
  reviewing: 'blue',
  accepted: 'green',
  rejected: 'red',
  withdrawn: 'light',
};

function ApplicantsTab({ groupId, jobId }: { groupId: string; jobId: string }) {
  const [filterStatus, setFilterStatus] = useState<ApplicantStatus | ''>('');
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.postings.workspace.getApplicants.useQuery({
    groupId,
    jobId,
    status: filterStatus || undefined,
  });
  const updateStatus = trpc.postings.workspace.updateApplicantStatus.useMutation({
    onSuccess: () => {
      toast.success('Applicant updated');
      utils.postings.workspace.getApplicants.invalidate({ groupId, jobId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ApplicantStatus | '')}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        >
          <option value="">All statuses</option>
          {APPLICANT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{data?.length || 0} applicants</span>
      </div>

      {(!data || data.length === 0) ? (
        <p className="text-sm text-gray-500 text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          No applicants{filterStatus ? ` with status "${filterStatus}"` : ' yet'}.
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <div
              key={a._id?.toString()}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {a.user?.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.user.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.robloxId ? (
                        <a
                          href={`https://www.roblox.com/users/${a.robloxId}/profile`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {a.user?.displayName || `Roblox ${a.robloxId}`}
                          {a.user?.username && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">
                              @{a.user.username}
                            </span>
                          )}
                        </a>
                      ) : (
                        <span className="font-medium">Unknown user</span>
                      )}
                      <Badge color={STATUS_BADGE[a.status] || 'light'}>{a.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Submitted via {a.submissionType.replace(/_/g, ' ')} ·{' '}
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                    {a.submissionType === 'readmin_resume' && a.resumeId && (
                      <Link
                        href={`/resume/${a.robloxId}`}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View resume →
                      </Link>
                    )}
                    {a.submissionType === 'readmin_application' && a.responseId && (
                      <Link
                        href={`/workspaces/${groupId}/forms/application/responses/${a.responseId}`}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View application response →
                      </Link>
                    )}
                    {a.submissionType === 'contact_info' && a.contactInfo && (
                      <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-800 rounded p-2">
                        {a.contactInfo.robloxUsername && (
                          <div>Roblox: {a.contactInfo.robloxUsername}</div>
                        )}
                        {a.contactInfo.discordUsername && (
                          <div>Discord: {a.contactInfo.discordUsername}</div>
                        )}
                        {a.contactInfo.message && (
                          <div className="whitespace-pre-wrap mt-1 text-gray-600 dark:text-gray-400">
                            {a.contactInfo.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <select
                  value={a.status}
                  disabled={a.status === 'withdrawn'}
                  onChange={(e) =>
                    updateStatus.mutate({
                      groupId,
                      applicationId: a._id!.toString(),
                      status: e.target.value as 'pending' | 'reviewing' | 'accepted' | 'rejected',
                    })
                  }
                  className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                >
                  <option value="pending">pending</option>
                  <option value="reviewing">reviewing</option>
                  <option value="accepted">accepted</option>
                  <option value="rejected">rejected</option>
                  {a.status === 'withdrawn' && <option value="withdrawn">withdrawn</option>}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePostingDetailPage() {
  const router = useRouter();
  const { groupId, jobId } = router.query as { groupId: string; jobId: string };
  const workspace = useWorkspace();
  const utils = trpc.useUtils();

  const canManage = !!(workspace?.department?.permissions?.admin || workspace?.department?.permissions?.postings?.canManage);
  const canViewApplicants = !!(workspace?.department?.permissions?.admin || workspace?.department?.permissions?.postings?.canViewApplicants);

  const [tab, setTab] = useState<'edit' | 'applicants'>(canManage ? 'edit' : 'applicants');
  const [value, setValue] = useState<PostingFormValue>(EMPTY_POSTING);

  const { data, isLoading } = trpc.postings.workspace.get.useQuery(
    { groupId, jobId },
    { enabled: !!groupId && !!jobId && canManage },
  );

  const update = trpc.postings.workspace.update.useMutation({
    onSuccess: () => {
      toast.success('Posting saved');
      utils.postings.workspace.get.invalidate({ groupId, jobId });
      utils.postings.workspace.list.invalidate({ groupId });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!data) return;
    setValue({
      title: data.title,
      shortSummary: data.shortSummary,
      description: data.description,
      requirements: data.requirements,
      tags: data.tags,
      compensation: data.compensation,
      applicationMethods: data.applicationMethods,
      visibility: data.visibility,
      opensAt: data.opensAt
        ? new Date(data.opensAt).toISOString().slice(0, 16)
        : undefined,
      closesAt: data.closesAt
        ? new Date(data.closesAt).toISOString().slice(0, 16)
        : undefined,
    });
  }, [data]);

  if (canManage && isLoading) return <LoadingPage />;

  function save() {
    if (!value.title || !value.shortSummary || !value.description) {
      toast.error('Title, summary and description are required.');
      return;
    }
    if (value.applicationMethods.length === 0) {
      toast.error('Add at least one application method.');
      return;
    }
    update.mutate({
      groupId,
      jobId,
      title: value.title,
      shortSummary: value.shortSummary,
      description: value.description,
      requirements: value.requirements,
      tags: value.tags,
      compensation: value.compensation,
      applicationMethods: value.applicationMethods,
      visibility: value.visibility,
      opensAt: value.opensAt ? new Date(value.opensAt) : null,
      closesAt: value.closesAt ? new Date(value.closesAt) : null,
    });
  }

  return (
    <>
      <PageHeading title={data?.title || 'Posting'} description={data?.shortSummary || ''}>
        <Link
          href={`/workspaces/${groupId}/postings`}
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium px-4 py-2 rounded-md"
        >
          ← Back
        </Link>
      </PageHeading>

      <div className="mt-4 border-b border-gray-200 dark:border-gray-800 flex gap-4">
        {canManage && (
          <button
            onClick={() => setTab('edit')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              tab === 'edit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            Edit
          </button>
        )}
        {canViewApplicants && (
          <button
            onClick={() => setTab('applicants')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              tab === 'applicants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            Applicants {data ? `(${data.applicantCount})` : ''}
          </button>
        )}
      </div>

      <div className="mt-6">
        {tab === 'edit' && canManage && (
          <>
            <PostingForm value={value} onChange={setValue} groupId={groupId} />
            <div className="mt-6 flex gap-2">
              <button
                onClick={save}
                disabled={update.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
        {tab === 'applicants' && canViewApplicants && (
          <ApplicantsTab groupId={groupId} jobId={jobId} />
        )}
      </div>
    </>
  );
}

WorkspacePostingDetailPage.getLayout = (page: ReactElement) => <WorkspaceLayout>{page}</WorkspaceLayout>;
