/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter } from 'next/router';
import { ReactElement, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import Badge from '~/components/ui/Badge';
import Modal from '~/components/ui/Modal';
import PageHeading from '~/components/layouts/PageHeading';
import { useWorkspace } from '~/components/contexts/workspace';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import {
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperClipIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
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

function AttachmentGallery({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="flex flex-row flex-wrap gap-2 mt-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={`Attachment ${i + 1}`}
            className="rounded-md border border-gray-200 dark:border-gray-700 max-h-28 max-w-[180px] object-cover hover:opacity-80 transition"
          />
        </a>
      ))}
    </div>
  );
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
          const newFiles = Array.from(e.target.files || []);
          const combined = [...files, ...newFiles].slice(0, 5);
          setFiles(combined);
          e.target.value = '';
        }}
      />
      {files.map((f, i) => (
        <span key={i} className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
          {f.name}
          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', color: 'yellow' as const, bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
  approved: { label: 'Approved', color: 'green' as const, bg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
  declined: { label: 'Declined', color: 'red' as const, bg: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
};

export default function PromotionRequestDetailPage() {
  const router = useRouter();
  const { groupId, requestId }: { groupId: string; requestId: string } = router.query as any;
  const workspace = useWorkspace();
  const authedUser = useUser();
  const currentRobloxId = authedUser && 'user' in authedUser && authedUser.user ? authedUser.user.dbUser.robloxId : undefined;

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeStatus, setCloseStatus] = useState<'approved' | 'declined'>('approved');
  const [closeComment, setCloseComment] = useState('');
  const [autoRankRoleId, setAutoRankRoleId] = useState<number | undefined>();
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [voteComment, setVoteComment] = useState('');
  const [voteFiles, setVoteFiles] = useState<File[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: request, refetch } =
    trpc.workspaces.workspace.promotionRequests.getById.useQuery(
      { groupId, requestId },
      { enabled: !!requestId },
    );
  const { data: canAutoRank } =
    trpc.workspaces.workspace.promotionRequests.canAutoRank.useQuery(
      { groupId },
      { enabled: !!groupId },
    );

  const voteMutation =
    trpc.workspaces.workspace.promotionRequests.vote.useMutation();
  const commentMutation =
    trpc.workspaces.workspace.promotionRequests.addComment.useMutation();
  const closeMutation =
    trpc.workspaces.workspace.promotionRequests.close.useMutation();
  const deleteMutation =
    trpc.workspaces.workspace.promotionRequests.delete.useMutation();

  const perms = workspace?.department?.permissions?.promotionRequests;
  const isAdmin = workspace?.department?.permissions?.admin;
  const canVote = isAdmin || perms?.view;
  const canManage = isAdmin || perms?.manage;
  const canDelete = isAdmin || perms?.delete;
  const isPending = request?.status === 'pending';

  if (!request) {
    return <LoadingPage />;
  }

  const supports = request.votes.filter((v) => v.vote === 'support').length;
  const opposes = request.votes.filter((v) => v.vote === 'oppose').length;
  const totalVotes = supports + opposes;
  const myVote = request.votes.find((v) => v.userId === currentRobloxId);
  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  // Merge votes and comments into a single timeline, sorted chronologically
  const timeline = [
    ...request.votes.map((v) => ({ ...v, _type: 'vote' as const })),
    ...request.comments.map((c) => ({ ...c, _type: 'comment' as const })),
  ].sort((a, b) => new Date(a.created as unknown as string).getTime() - new Date(b.created as unknown as string).getTime());

  async function prepareFiles(files: File[]): Promise<[string, string][]> {
    const prepared: [string, string][] = [];
    for (const file of files) {
      const b64 = await fileToBase64(file);
      prepared.push([file.name, b64]);
    }
    return prepared;
  }

  async function handleVote(vote: 'support' | 'oppose') {
    if (!voteComment.trim()) {
      toast.error('You must leave a comment with your vote.');
      return;
    }
    const files = await prepareFiles(voteFiles);
    voteMutation
      .mutateAsync({ groupId, requestId, vote, comment: voteComment, files })
      .then(() => {
        toast.success('Vote recorded');
        setVoteComment('');
        setVoteFiles([]);
        refetch();
      })
      .catch((e: any) => toast.error(e?.message || 'Failed to vote'));
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const files = await prepareFiles(commentFiles);
    commentMutation
      .mutateAsync({ groupId, requestId, message: commentText, files })
      .then(() => {
        toast.success('Comment added');
        setCommentText('');
        setCommentFiles([]);
        refetch();
      })
      .catch((e: any) => toast.error(e?.message || 'Failed to add comment'));
  }

  function handleClose() {
    closeMutation
      .mutateAsync({
        groupId,
        requestId,
        status: closeStatus,
        closeComment: closeComment || undefined,
        autoRankToRoleId: closeStatus === 'approved' ? autoRankRoleId : undefined,
      })
      .then((res) => {
        const msg = closeStatus === 'approved'
          ? res.rankedTo
            ? `Approved! User ranked to ${res.rankedTo}`
            : 'Request approved'
          : 'Request closed';
        toast.success(msg);
        setCloseModalOpen(false);
        refetch();
      })
      .catch((e: any) => toast.error(e?.message || 'Failed to close request'));
  }

  function handleDelete() {
    deleteMutation
      .mutateAsync({ groupId, requestId })
      .then(() => {
        toast.success('Promotion request deleted');
        router.push(`/workspaces/${groupId}/promotion-requests`);
      })
      .catch((e: any) => toast.error(e?.message || 'Failed to delete'));
  }

  return (
    <>
      {/* Back link */}
      <button
        onClick={() => router.push(`/workspaces/${groupId}/promotion-requests`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition mb-4"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Back to requests
      </button>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Target user */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <TextReturnForUserId userId={request.targetUserId} includeImage />
            </div>
            <div className={`ml-auto sm:ml-0 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg}`}>
              {statusConfig.label}
            </div>
          </div>

          {/* Actions — inline for managers, keeps page clean */}
          {(canManage || canDelete) && isPending && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManage && (
                <>
                  <Button
                    variant="success"
                    size="small"
                    onClick={() => {
                      setCloseStatus('approved');
                      setCloseComment('');
                      setAutoRankRoleId(request.requestedRoleId ?? undefined);
                      setCloseModalOpen(true);
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="discrete"
                    size="small"
                    onClick={() => {
                      setCloseStatus('declined');
                      setCloseComment('');
                      setCloseModalOpen(true);
                    }}
                  >
                    Decline
                  </Button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  title="Delete request"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {/* Non-pending actions: only delete */}
          {canDelete && !isPending && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex-shrink-0"
              title="Delete request"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role progression strip */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Current</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{request.currentRoleName || 'Unknown'}</span>
          </div>
          {request.requestedRoleName && (
            <>
              <ArrowUpIcon className="w-4 h-4 text-blue-400 rotate-45" />
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Requested</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{request.requestedRoleName}</span>
              </div>
            </>
          )}
          {request.rankedTo && (
            <Badge color="green">Ranked to {request.rankedTo}</Badge>
          )}
          <span className="ml-auto text-xs text-gray-400">
            <ReactTimeago date={request.created as unknown as string} />
            {' · '}
            Requested by <TextReturnForUserId userId={request.requestedBy} />
          </span>
        </div>
      </div>

      {/* ── Two-column body ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Main column */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Reason section */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Reason for promotion</p>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{request.reason}</p>
            <AttachmentGallery urls={request.attachments} />
          </div>

          {/* Closed result banner */}
          {request.closeComment && (
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              request.status === 'approved'
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800'
                : 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700'
            }`}>
              {request.status === 'approved' ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {request.status === 'approved' ? 'Approved' : 'Declined'}
                  {request.closedByName && <span className="font-normal text-gray-500"> by {request.closedByName}</span>}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{request.closeComment}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h3>
              <span className="text-xs text-gray-400">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {request.comments.length} comment{request.comments.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Vote bar */}
            {totalVotes > 0 && (
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-600 tabular-nums w-6 text-right">{supports}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(supports / totalVotes) * 100}%` }} />
                  <div className="bg-red-400 h-full transition-all" style={{ width: `${(opposes / totalVotes) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-red-500 tabular-nums w-6">{opposes}</span>
              </div>
            )}

            {/* Timeline entries */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {timeline.map((entry, i) => {
                if (entry._type === 'vote') {
                  const v = entry as typeof request.votes[0] & { _type: 'vote' };
                  const isSupport = v.vote === 'support';
                  return (
                    <div key={`v-${i}`} className="px-5 py-4 flex gap-3">
                      <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                        isSupport ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {isSupport ? (
                          <HandThumbUpIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <HandThumbDownIcon className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <TextReturnForUserId userId={v.userId} />
                          {v.roleName && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                              {v.roleName}
                            </span>
                          )}
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                            isSupport
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
                          }`}>
                            {isSupport ? 'Support' : 'Oppose'}
                          </span>
                          <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                            <ReactTimeago date={v.created as unknown as string} />
                          </span>
                        </div>
                        {v.comment && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed whitespace-pre-wrap">{v.comment}</p>
                        )}
                        <AttachmentGallery urls={v.attachments} />
                      </div>
                    </div>
                  );
                } else {
                  const c = entry as typeof request.comments[0] & { _type: 'comment' };
                  return (
                    <div key={`c-${i}`} className="px-5 py-4 flex gap-3">
                      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                        <ChatBubbleLeftIcon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <TextReturnForUserId userId={c.userId} />
                          {c.roleName && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                              {c.roleName}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                            <ReactTimeago date={c.created as unknown as string} />
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                        <AttachmentGallery urls={c.attachments} />
                      </div>
                    </div>
                  );
                }
              })}

              {timeline.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <ChatBubbleLeftIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No activity yet. Be the first to vote or comment.</p>
                </div>
              )}
            </div>

            {/* Vote form */}
            {canVote && isPending && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/40">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {myVote ? 'Change your vote' : 'Cast your vote'}
                </p>
                <textarea
                  value={voteComment}
                  onChange={(e) => setVoteComment(e.target.value)}
                  placeholder="Explain your vote (required)..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[60px] resize-none transition"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <FilePickerPreview files={voteFiles} setFiles={setVoteFiles} />
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant={myVote?.vote === 'support' ? 'success' : 'discrete'}
                      size="small"
                      onClick={() => handleVote('support')}
                      disabled={voteMutation.isPending || !voteComment.trim()}
                    >
                      <HandThumbUpIcon className="w-3.5 h-3.5 mr-1" />
                      Support
                    </Button>
                    <Button
                      variant={myVote?.vote === 'oppose' ? 'danger' : 'discrete'}
                      size="small"
                      onClick={() => handleVote('oppose')}
                      disabled={voteMutation.isPending || !voteComment.trim()}
                    >
                      <HandThumbDownIcon className="w-3.5 h-3.5 mr-1" />
                      Oppose
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Comment form */}
            {isPending && (
              <form onSubmit={handleComment} className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                    maxLength={2000}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="small"
                    disabled={commentMutation.isPending || !commentText.trim()}
                  >
                    {commentMutation.isPending ? '...' : 'Send'}
                  </Button>
                </div>
                <FilePickerPreview files={commentFiles} setFiles={setCommentFiles} />
              </form>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Vote summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Vote Summary</h3>
            <div className="flex items-end gap-4 mb-4">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-emerald-600">{supports}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Support</p>
              </div>
              <div className="text-gray-300 dark:text-gray-600 text-lg font-light">/</div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-red-500">{opposes}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Oppose</p>
              </div>
            </div>
            {totalVotes > 0 && (
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(supports / totalVotes) * 100}%` }} />
                <div className="bg-red-400 h-full transition-all" style={{ width: `${(opposes / totalVotes) * 100}%` }} />
              </div>
            )}
          </div>

          {/* Voters list */}
          {request.votes.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Voters</h3>
              <div className="space-y-2.5">
                {request.votes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.vote === 'support' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0 text-sm">
                      <TextReturnForUserId userId={v.userId} />
                    </div>
                    {v.roleName && (
                      <span className="text-[11px] text-gray-400 truncate max-w-[100px]">{v.roleName}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Approve / Decline Modal ─────────────────────── */}
      <Modal open={closeModalOpen} setOpen={setCloseModalOpen} sizeOverride="md">
        <div className="flex flex-col gap-4">
          <PageHeading
            title={closeStatus === 'approved' ? 'Approve Request' : 'Decline Request'}
            description={
              closeStatus === 'approved'
                ? 'Add a closing comment and optionally auto-rank the user.'
                : 'Close this request. The status will not be shown publicly as a rejection.'
            }
            disableDivide
            className="mb-0"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Closing Comment {closeStatus === 'approved' ? '' : '(optional)'}
            </label>
            <textarea
              value={closeComment}
              onChange={(e) => setCloseComment(e.target.value)}
              placeholder={
                closeStatus === 'approved'
                  ? 'Approved! User was ranked to...'
                  : 'Optional note...'
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[80px] resize-none transition"
              maxLength={2000}
            />
          </div>

          {closeStatus === 'approved' && canAutoRank && workspace?.roles && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Auto-rank user to role (optional)
              </label>
              <select
                value={autoRankRoleId || ''}
                onChange={(e) => setAutoRankRoleId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              >
                <option value="">Don&apos;t auto-rank</option>
                {workspace.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                If selected, the user will be automatically ranked in the Roblox group.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="discrete" size="medium" onClick={() => setCloseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={closeStatus === 'approved' ? 'success' : 'default'}
              size="medium"
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending
                ? 'Processing...'
                : closeStatus === 'approved'
                  ? 'Approve'
                  : 'Decline'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation ────────────────────────── */}
      <Modal open={deleteConfirmOpen} setOpen={setDeleteConfirmOpen} sizeOverride="sm">
        <div className="flex flex-col gap-4">
          <PageHeading
            title="Delete Promotion Request"
            description="Are you sure? This action cannot be undone."
            disableDivide
            className="mb-0"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="discrete" size="medium" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="medium"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

PromotionRequestDetailPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
