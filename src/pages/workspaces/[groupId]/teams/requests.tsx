'use client';

import { useRouter } from 'next/router';
import { JSX, ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckIcon, XMarkIcon, ClockIcon, CurrencyDollarIcon, PlusIcon, UserGroupIcon, UsersIcon, ChartBarIcon, PaperClipIcon } from '@heroicons/react/20/solid';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Modal from '~/components/ui/Modal';
import { useWorkspace } from '~/components/contexts/workspace';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import HeadshotForUserId from '~/components/ui/HeadshotForUserId';

type Tab = 'time-off' | 'expenses';
type View = 'mine' | 'approvals';

function SubmitExpenseModal({
  open,
  setOpen,
  groupId,
  teams,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  teams: { _id?: any; name: string }[];
  onDone: () => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?._id?.toString() ?? '');
  const [category, setCategory] = useState<'robux' | 'budget' | 'general'>('robux');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; data: string }[]>([]);
  const submit = trpc.workspaces.workspace.teams.expenses.submit.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const remaining = 5 - attachments.length;
    if (remaining <= 0) return toast.error('You can attach up to 5 files.');
    files.slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        setAttachments((prev) => (prev.length >= 5 ? prev : [...prev, { name: file.name, data }]));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!teamId || !title.trim() || !description.trim() || !amount) return toast.error('All fields are required.');
    await toast.promise(
      submit.mutateAsync({
        groupId,
        teamId,
        category,
        amount: parseFloat(amount),
        title,
        description,
        attachments: attachments.length > 0 ? attachments.map((a) => [a.name, a.data] as [string, string]) : undefined,
      }),
      { loading: 'Submitting...', success: 'Expense request submitted!', error: (e) => e?.message ?? 'Failed.' },
    );
    setTitle(''); setDescription(''); setAmount(''); setAttachments([]);
    setOpen(false);
    onDone();
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="md">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Request Expense</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100">
              {teams.map((t) => <option key={t._id.toString()} value={t._id.toString()}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <div className="flex gap-2">
              {(['robux', 'budget', 'general'] as const).map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition capitalize ${category === c ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount {category === 'robux' ? '(R$)' : '($)'}
            </label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the expense"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description / Justification</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Why is this expense needed?"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Attachments <span className="text-gray-400">(optional, up to 5)</span>
            </label>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 truncate">
                      <PaperClipIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500 transition shrink-0"
                      aria-label="Remove attachment"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length < 5 && (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition text-sm text-gray-600 dark:text-gray-400">
                <input type="file" multiple className="hidden" onChange={handleFileSelect} />
                <PaperClipIcon className="w-4 h-4" />
                Attach receipt or supporting file
              </label>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submit.isPending}>Submit</Button>
        </div>
      </div>
    </Modal>
  );
}

function SubmitTimeOffModal({
  open,
  setOpen,
  groupId,
  teams,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  teams: { _id?: any; name: string }[];
  onDone: () => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?._id?.toString() ?? '');
  const [reason, setReason] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const submit = trpc.workspaces.workspace.teams.timeOff.submit.useMutation();

  const handleSubmit = async () => {
    if (!teamId || !reason.trim() || !starts || !ends) return toast.error('All fields are required.');
    await toast.promise(
      submit.mutateAsync({ groupId, teamId, reason, starts, ends }),
      { loading: 'Submitting...', success: 'Time off request submitted!', error: (e: any) => e?.message ?? 'Failed.' },
    );
    setReason(''); setStarts(''); setEnds('');
    setOpen(false);
    onDone();
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="md">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Request Time Off</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100">
              {teams.map((t) => <option key={t._id.toString()} value={t._id.toString()}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Why are you requesting time off?"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submit.isPending}>Submit</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewModal({
  requestId,
  open,
  setOpen,
  type,
  groupId,
  onDone,
}: {
  requestId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  type: 'time-off' | 'expense';
  groupId: string;
  onDone: () => void;
}) {
  const [decision, setDecision] = useState<'approved' | 'denied'>('approved');
  const [note, setNote] = useState('');
  const reviewTimeOff = trpc.workspaces.workspace.teams.timeOff.review.useMutation();
  const reviewExpense = trpc.workspaces.workspace.teams.expenses.review.useMutation();

  const handleReview = async () => {
    const mutation = type === 'time-off' ? reviewTimeOff : reviewExpense;
    await toast.promise(
      mutation.mutateAsync({ groupId, requestId, decision, reviewNote: note || undefined }),
      { loading: 'Reviewing...', success: `Request ${decision}!`, error: (e) => e?.message ?? 'Failed.' },
    );
    setNote('');
    setOpen(false);
    onDone();
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="sm">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Review Request</h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setDecision('approved')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${decision === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>
              ✓ Approve
            </button>
            <button onClick={() => setDecision('denied')}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${decision === 'denied' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>
              ✗ Deny
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              placeholder="Leave a note for the requester..." />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={decision === 'approved' ? 'success' : 'danger'} onClick={handleReview}>
            {decision === 'approved' ? 'Approve' : 'Deny'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

type ChainStep = {
  index: number;
  label: string;
  type: string;
  approverIds: string[];
  status: 'pending' | 'approved' | 'denied' | 'skipped';
  decidedBy?: string;
  note?: string;
};

type RequestComment = { id: string; userId: string; text: string; created: string | Date };

function ApprovalChainBar({
  chain,
  currentStepIndex,
  requestStatus,
}: {
  chain: ChainStep[];
  currentStepIndex: number;
  requestStatus: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chain.map((step, i) => {
        const isCurrent = requestStatus === 'pending' && i === currentStepIndex;
        const dot =
          step.status === 'approved'
            ? 'bg-green-500 text-white'
            : step.status === 'denied'
              ? 'bg-red-500 text-white'
              : isCurrent
                ? 'bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-900'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
        return (
          <div key={step.index} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${dot}`}
              title={step.approverIds.length ? `${step.approverIds.length} approver(s)` : 'No eligible approver — admins can action'}
            >
              {step.status === 'approved' ? (
                <CheckIcon className="h-3 w-3" />
              ) : step.status === 'denied' ? (
                <XMarkIcon className="h-3 w-3" />
              ) : null}
              {step.label}
            </span>
            {i < chain.length - 1 && <span className="text-gray-300 dark:text-gray-600">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function CommentsSection({
  groupId,
  requestId,
  type,
  comments,
  canComment,
  onDone,
}: {
  groupId: string;
  requestId: string;
  type: Tab;
  comments: RequestComment[];
  canComment: boolean;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const addTimeOff = trpc.workspaces.workspace.teams.timeOff.addComment.useMutation();
  const addExpense = trpc.workspaces.workspace.teams.expenses.addComment.useMutation();
  const mutation = type === 'time-off' ? addTimeOff : addExpense;

  const send = async () => {
    if (!text.trim()) return;
    await toast.promise(
      mutation.mutateAsync({ groupId, requestId, text: text.trim() }),
      { loading: 'Posting...', success: 'Comment added.', error: (e: any) => e?.message ?? 'Failed.' },
    );
    setText('');
    onDone();
  };

  return (
    <div className="mt-2 space-y-2">
      {comments.length === 0 ? (
        <p className="text-xs text-gray-400">No comments yet.</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <HeadshotForUserId userId={c.userId} size={24} />
            <div className="min-w-0 flex-1 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  <TextReturnForUserId userId={c.userId} />
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(c.created).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">{c.text}</p>
            </div>
          </div>
        ))
      )}
      {canComment && (
        <div className="flex items-end gap-2 pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder="Add a comment (e.g. how it was disbursed)…"
            className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <Button variant="primary" size="small" onClick={send} disabled={mutation.isPending || !text.trim()}>
            Post
          </Button>
        </div>
      )}
    </div>
  );
}

function RequestExtras({
  req,
  type,
  groupId,
  currentUserId,
  canApprove,
  onDone,
}: {
  req: any;
  type: Tab;
  groupId: string;
  currentUserId: string;
  canApprove: boolean;
  onDone: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const chain: ChainStep[] | undefined = req.approvalChain;
  const comments: RequestComment[] = req.comments ?? [];
  const isApproverHere = (chain ?? []).some((s) => (s.approverIds ?? []).includes(currentUserId));
  const canComment = canApprove || req.userId === currentUserId || isApproverHere;

  if ((!chain || chain.length === 0) && comments.length === 0 && !canComment) return null;

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700/60 pt-3 space-y-2">
      {chain && chain.length > 0 && (
        <ApprovalChainBar chain={chain} currentStepIndex={req.currentStepIndex ?? 0} requestStatus={req.status} />
      )}
      <button
        onClick={() => setShowComments((s) => !s)}
        className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {showComments ? 'Hide' : 'Show'} comments ({comments.length})
      </button>
      {showComments && (
        <CommentsSection
          groupId={groupId}
          requestId={req._id.toString()}
          type={type}
          comments={comments}
          canComment={canComment}
          onDone={onDone}
        />
      )}
    </div>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const user = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [view, setView] = useState<View>('mine');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [submitExpenseOpen, setSubmitExpenseOpen] = useState(false);
  const [submitTimeOffOpen, setSubmitTimeOffOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; type: Tab } | null>(null);

  const { data: teams } = trpc.workspaces.workspace.teams.teams.getAll.useQuery({ groupId }, { enabled: !!groupId });
  const { data: myExpenses, refetch: refetchMyExpenses } = trpc.workspaces.workspace.teams.expenses.getMyRequests.useQuery({ groupId }, { enabled: !!groupId });
  const { data: pendingExpenses, refetch: refetchPendingExpenses } = trpc.workspaces.workspace.teams.expenses.getPendingApprovals.useQuery({ groupId }, { enabled: !!groupId });
  const { data: myTimeOff, refetch: refetchMyTimeOff } = trpc.workspaces.workspace.teams.timeOff.getMyRequests.useQuery({ groupId }, { enabled: !!groupId });
  const { data: pendingTimeOff, refetch: refetchPendingTimeOff } = trpc.workspaces.workspace.teams.timeOff.getPendingApprovals.useQuery({ groupId }, { enabled: !!groupId });

  if (!workspace || !('user' in user)) return <LoadingPage />;

  const currentUserId = String((user as any).user.dbUser.robloxId ?? '');
  const canApprove = workspace.department.permissions.admin || workspace.department.permissions.teams?.approve || workspace.department.permissions.teams?.manage;
  const canRequestExpense = workspace.teamsSettings?.allowMemberExpenseRequests !== false || canApprove;

  const refetchAll = () => {
    refetchMyExpenses(); refetchPendingExpenses();
    refetchMyTimeOff(); refetchPendingTimeOff();
  };

  const teamMap = new Map(teams?.map((t) => [t._id?.toString(), t.name]) ?? []);
  const applyStatusFilter = <T extends { status: string }>(items: T[] | undefined): T[] | undefined => {
    if (!items) return items;
    if (view !== 'mine' || statusFilter === 'all') return items;
    return items.filter((i) => i.status === statusFilter);
  };
  const expenseItems = applyStatusFilter(view === 'mine' ? myExpenses : pendingExpenses);
  const timeOffItems = applyStatusFilter(view === 'mine' ? myTimeOff : pendingTimeOff);

  return (
    <>
      <PageHeading
        title="Requests"
        description="Submit and manage time off and expense requests."
      >
        <div className="flex gap-2">
          <Button variant="discrete" icon={ClockIcon} onClick={() => setSubmitTimeOffOpen(true)}>
            Request Time Off
          </Button>
          {canRequestExpense && (
            <Button variant="primary" icon={CurrencyDollarIcon} onClick={() => setSubmitExpenseOpen(true)}>
              Request Expense
            </Button>
          )}
        </div>
      </PageHeading>

      <div className="px-6 pb-6">
        {/* Tab + view toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
            {(['time-off', 'expenses'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === t
                    ? `bg-${workspace.brandColor}-500 text-white`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                {t === 'time-off' ? 'Time Off' : 'Expenses'}
              </button>
            ))}
          </div>
          {canApprove && (
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
              {(['mine', 'approvals'] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-4 py-2 text-sm font-medium transition capitalize ${
                    view === v
                      ? `bg-${workspace.brandColor}-500 text-white`
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {v === 'mine' ? 'My Requests' : 'Approval Queue'}
                  {v === 'approvals' && ((pendingExpenses?.length ?? 0) + (pendingTimeOff?.length ?? 0)) > 0 && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-red-500 text-white text-xs px-1.5">
                      {(pendingExpenses?.length ?? 0) + (pendingTimeOff?.length ?? 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status filter (history) — only for personal requests */}
        {view === 'mine' && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'pending', 'approved', 'denied'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
                  statusFilter === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'time-off' && (
          <div className="space-y-3">
            {!timeOffItems ? <p className="text-sm text-gray-400">Loading...</p> :
              timeOffItems.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                  <ClockIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No {view === 'approvals' ? 'pending' : ''} time off requests.</p>
                </div>
              ) : (
                timeOffItems.map((req: any) => (
                  <div key={req._id?.toString()}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {view === 'approvals' && <HeadshotForUserId userId={req.userId} size={36} />}
                      <div className="min-w-0 flex-1">
                        {view === 'approvals' && (
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            <TextReturnForUserId userId={req.userId} />
                          </p>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{req.reason}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {new Date(req.starts).toLocaleDateString()} → {new Date(req.ends).toLocaleDateString()}
                          </span>
                          {teamMap.get(req.teamId?.toString()) && (
                            <span className="text-xs text-gray-400">{teamMap.get(req.teamId?.toString())}</span>
                          )}
                        </div>
                        {req.reviewNote && (
                          <p className="text-xs text-gray-500 italic mt-0.5">Note: {req.reviewNote}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColors[req.status]}`}>
                        {req.status}
                      </span>
                      {view === 'approvals' && req.status === 'pending' && (
                        <Button variant="blue" size="small"
                          onClick={() => setReviewTarget({ id: req._id.toString(), type: 'time-off' })}>
                          Review
                        </Button>
                      )}
                    </div>
                    </div>
                    <RequestExtras req={req} type="time-off" groupId={groupId} currentUserId={currentUserId} canApprove={canApprove} onDone={refetchAll} />
                  </div>
                ))
              )
            }
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {!expenseItems ? <p className="text-sm text-gray-400">Loading...</p> :
              expenseItems.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                  <CurrencyDollarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No {view === 'approvals' ? 'pending' : ''} expense requests.</p>
                </div>
              ) : (
                expenseItems.map((req: any) => (
                  <div key={req._id?.toString()}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {view === 'approvals' && <HeadshotForUserId userId={req.userId} size={36} />}
                      <div className="min-w-0 flex-1">
                        {view === 'approvals' && (
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            <TextReturnForUserId userId={req.userId} />
                          </p>
                        )}
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{req.title}</p>
                        <p className="text-xs text-gray-500 truncate">{req.description}</p>
                        {Array.isArray(req.attachments) && req.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {req.attachments.map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                              >
                                <PaperClipIcon className="w-3 h-3" />
                                Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {req.category === 'robux' ? `R$ ${req.amount.toLocaleString()}` : `$${req.amount.toLocaleString()}`}
                          </span>
                          <span className={`text-xs capitalize px-1.5 py-0.5 rounded-full ${
                            req.category === 'robux' ? 'bg-green-100 text-green-700' :
                            req.category === 'budget' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{req.category}</span>
                          {teamMap.get(req.teamId?.toString()) && (
                            <span className="text-xs text-gray-400">{teamMap.get(req.teamId?.toString())}</span>
                          )}
                        </div>
                        {req.reviewNote && (
                          <p className="text-xs text-gray-500 italic mt-0.5">Note: {req.reviewNote}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColors[req.status]}`}>
                        {req.status}
                      </span>
                      {view === 'approvals' && req.status === 'pending' && (
                        <Button variant="blue" size="small"
                          onClick={() => setReviewTarget({ id: req._id.toString(), type: 'expenses' })}>
                          Review
                        </Button>
                      )}
                    </div>
                    </div>
                    <RequestExtras req={req} type="expenses" groupId={groupId} currentUserId={currentUserId} canApprove={canApprove} onDone={refetchAll} />
                  </div>
                ))
              )
            }
          </div>
        )}
      </div>

      {submitTimeOffOpen && teams && (
        <SubmitTimeOffModal
          open={submitTimeOffOpen}
          setOpen={setSubmitTimeOffOpen}
          groupId={groupId}
          teams={teams}
          onDone={refetchAll}
        />
      )}
      {submitExpenseOpen && teams && (
        <SubmitExpenseModal
          open={submitExpenseOpen}
          setOpen={setSubmitExpenseOpen}
          groupId={groupId}
          teams={teams}
          onDone={refetchAll}
        />
      )}
      {reviewTarget && (
        <ReviewModal
          requestId={reviewTarget.id}
          open={!!reviewTarget}
          setOpen={(v) => !v && setReviewTarget(null)}
          type={reviewTarget.type === 'expenses' ? 'expense' : 'time-off'}
          groupId={groupId}
          onDone={refetchAll}
        />
      )}
    </>
  );
}

RequestsPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Requests" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
