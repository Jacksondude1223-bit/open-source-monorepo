'use client';

import { useRouter } from 'next/router';
import { ReactElement, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import Card from '~/components/ui/Card';
import Modal from '~/components/ui/Modal';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Badge from '~/components/ui/Badge';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import {
  MagnifyingGlassIcon,
  ArrowUpCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
  XMarkIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import ReactTimeago from 'react-timeago';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FilePickerPreview({
  files,
  setFiles,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-row flex-wrap gap-2 items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
      >
        <PaperClipIcon className="w-4 h-4" />
        Attach images
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            const combined = [...files, ...Array.from(e.target.files)].slice(0, 5);
            setFiles(combined);
          }
          e.target.value = '';
        }}
      />
      {files.map((f, i) => (
        <span
          key={i}
          className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5"
        >
          {f.name}
          <button
            type="button"
            onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, 'yellow' | 'green' | 'red' | 'light'> = {
  pending: 'yellow',
  approved: 'green',
  declined: 'red',
};

export default function PromotionRequestsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all');
  const [targetUserId, setTargetUserId] = useState('0');
  const [requestedRoleId, setRequestedRoleId] = useState<number | undefined>();
  const [createFiles, setCreateFiles] = useState<File[]>([]);

  const { data: requests } =
    trpc.workspaces.workspace.promotionRequests.getAll.useQuery({ groupId });
  const createMutation =
    trpc.workspaces.workspace.promotionRequests.create.useMutation();
  const context = trpc.useUtils();

  const perms = workspace?.department?.permissions?.promotionRequests;
  const isAdmin = workspace?.department?.permissions?.admin;
  const canView = isAdmin || perms?.view || perms?.manage;
  const canCreate = isAdmin || perms?.create;

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    let list = requests;
    if (filter !== 'all') {
      list = list.filter((r) => r.status === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        [r.targetUserName, r.requestedByName, r.reason, r.currentRoleName, r.requestedRoleName]
          .some((f) => f?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [requests, search, filter]);

  const pendingCount = requests?.filter((r) => r.status === 'pending').length ?? 0;

  if (!canView) {
    return (
      <>
        <PageHeading
          title="Promotion Requests"
          disableDivide
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Insufficient Permissions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You don&apos;t have permission to view promotion requests.
          </p>
        </div>
      </>
    );
  }

  if (!requests) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title="Promotion Requests"
        disableDivide
      />

      {/* Summary bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <ArrowUpCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {requests.length} total request{requests.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pendingCount} pending review
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 w-full sm:w-56 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <FunnelIcon className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="pl-7 pr-6 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              {canCreate && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  variant="primary"
                  size="medium"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  New Request
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredRequests.length === 0 && (
        <div className="py-16 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <ArrowUpCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {requests.length > 0 ? 'No matching requests' : 'No promotion requests yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {requests.length > 0
              ? 'Try adjusting your search or filters.'
              : canCreate
                ? 'Create one to get started.'
                : 'None have been submitted yet.'}
          </p>
          {canCreate && requests.length === 0 && (
            <Button variant="primary" size="medium" className="mt-4" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="w-4 h-4 mr-1" />
              New Request
            </Button>
          )}
        </div>
      )}

      {/* Request list */}
      {filteredRequests.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredRequests.map((request) => {
            const supports = request.votes.filter((v) => v.vote === 'support').length;
            const opposes = request.votes.filter((v) => v.vote === 'oppose').length;
            const totalVotes = supports + opposes;
            return (
              <button
                key={(request._id || '').toString()}
                onClick={() =>
                  router.push(`/workspaces/${groupId}/promotion-requests/${(request._id || '').toString()}`)
                }
                className="w-full text-left"
              >
                <Card className="flex flex-col gap-3 transition hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TextReturnForUserId userId={request.targetUserId} includeImage />
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span>{request.currentRoleName}</span>
                        {request.requestedRoleName && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{request.requestedRoleName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge color={STATUS_COLORS[request.status] || 'light'}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{request.reason}</p>

                  {/* Vote bar (compact) */}
                  {totalVotes > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(supports / totalVotes) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {supports}:{opposes}
                      </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className="flex items-center gap-1">
                      <HandThumbUpIcon className="w-3.5 h-3.5 text-green-500" /> {supports}
                    </span>
                    <span className="flex items-center gap-1">
                      <HandThumbDownIcon className="w-3.5 h-3.5 text-red-500" /> {opposes}
                    </span>
                    <span className="flex items-center gap-1">
                      <ChatBubbleLeftIcon className="w-3.5 h-3.5" /> {request.comments.length}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      by <TextReturnForUserId userId={request.requestedBy} />
                    </span>
                    <ReactTimeago date={request.created as unknown as string} />
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} setOpen={setCreateOpen} sizeOverride="lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(f) => {
            f.preventDefault();
            const target = f.target as any;
            const reason = target.reason.value;
            if (!targetUserId || targetUserId === '0') {
              toast.error('Please select a user to nominate.');
              return;
            }
            (async () => {
              const files: [string, string][] = await Promise.all(
                createFiles.map(async (f): Promise<[string, string]> => [f.name, await fileToBase64(f)]),
              );
              return createMutation.mutateAsync({
                groupId,
                targetUserId,
                requestedRoleId,
                reason,
                files: files.length > 0 ? files : undefined,
              });
            })()
              .then(() => {
                toast.success('Promotion request created');
                context.workspaces.workspace.promotionRequests.getAll.invalidate({ groupId });
                setCreateOpen(false);
                setTargetUserId('0');
                setRequestedRoleId(undefined);
                setCreateFiles([]);
              })
              .catch((e: any) => {
                toast.error(e?.message || 'Something went wrong');
              });
          }}
        >
          <PageHeading
            title="New Promotion Request"
            description="Nominate a user for promotion. Other staff can vote and leave feedback."
            disableDivide
            className="mb-0"
          />
          {createMutation.isPending ? (
            <LoadingPage />
          ) : (
            <>
              <RobloxUserSearch
                label="User to Nominate"
                placeholder="Search for a user..."
                onSelectUser={(userId) => setTargetUserId(userId)}
                groupId={groupId}
                required
              />
              {workspace?.roles && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Requested Role (optional)
                  </label>
                  <select
                    value={requestedRoleId || ''}
                    onChange={(e) => setRequestedRoleId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No specific role</option>
                    {workspace.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <TextLabel
                id="reason"
                label="Reason for Promotion"
                placeholder="Why should this user be promoted?"
                required
              />
              <FilePickerPreview files={createFiles} setFiles={setCreateFiles} />
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}

PromotionRequestsPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
