'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { JSX, ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, UserMinusIcon, UserGroupIcon, PencilIcon, UsersIcon, ChartBarIcon, ClockIcon, CurrencyDollarIcon, DocumentIcon, PaperClipIcon, BookOpenIcon, ShieldCheckIcon, ClipboardDocumentListIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Modal from '~/components/ui/Modal';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc, RouterOutput } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import HeadshotForUserId from '~/components/ui/HeadshotForUserId';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { useConfirm } from '~/components/ui/ConfirmModal';
import SlideOutDrawer from '~/components/ui/SlideOutDrawer';
import ReactTimeago from 'react-timeago';

type TeamDetail = RouterOutput['workspaces']['workspace']['teams']['teams']['getById'];

function AddMemberModal({
  open,
  setOpen,
  groupId,
  team,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  team: TeamDetail;
  onDone: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState(team?.roles[0]?.id ?? '');
  const addMember = trpc.workspaces.workspace.teams.members.addMember.useMutation();

  const handleAdd = async () => {
    if (!userId) return toast.error('Select a user first — type a username in the search box and click a result.');
    if (!roleId) return toast.error('Select a role.');
    await toast.promise(
      addMember.mutateAsync({ groupId, teamId: team!._id!.toString(), userId, roleId }),
      {
        loading: 'Adding member...',
        success: 'Member added!',
        error: (e) => e?.message ?? 'Failed.',
      },
    );
    setUserId('');
    setOpen(false);
    onDone();
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="md">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Add Member</h2>
        {(!team?.roles || team.roles.length === 0) ? (
          <>
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No roles defined yet</p>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Create at least one role in Team Settings before adding members.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="discrete" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Type a Roblox username in the box below, then click a result to select them.</p>
                <RobloxUserSearch
                  groupId={groupId}
                  placeholder="Type a username..."
                  onSelectUser={(id: string) => setUserId(id)}
                />
                {userId && (
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ User selected</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {team?.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isLead ? '(Lead)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="discrete" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAdd} disabled={addMember.isPending || !userId}>Add Member</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function GiveFeedbackModal({
  open,
  setOpen,
  groupId,
  teamId,
  targetUserId,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  teamId: string;
  targetUserId: string;
  onDone: () => void;
}) {
  const [type, setType] = useState<'commendation' | 'poor_performance' | 'strike' | 'demotion_recommendation'>('commendation');
  const [note, setNote] = useState('');
  const submitFeedback = trpc.workspaces.workspace.teams.feedback.submit.useMutation();

  const handleSubmit = async () => {
    if (!note.trim()) return toast.error('Note is required.');
    await toast.promise(
      submitFeedback.mutateAsync({ groupId, teamId, toUserId: targetUserId, type, note }),
      {
        loading: 'Submitting feedback...',
        success: 'Feedback submitted!',
        error: (e) => e?.message ?? 'Failed.',
      },
    );
    setNote('');
    setType('commendation');
    setOpen(false);
    onDone();
  };

  const typeLabels = {
    commendation: { label: 'Commendation', color: 'text-green-600' },
    poor_performance: { label: 'Poor Performance', color: 'text-yellow-600' },
    strike: { label: 'Strike', color: 'text-orange-600' },
    demotion_recommendation: { label: 'Demotion Recommendation', color: 'text-red-600' },
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="md">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Give Feedback</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(typeLabels) as (keyof typeof typeLabels)[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    type === k
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <span className={typeLabels[k].color}>{typeLabels[k].label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Provide context and details..."
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitFeedback.isPending}>Submit Feedback</Button>
        </div>
      </div>
    </Modal>
  );
}

const DOC_CATEGORIES = [
  { value: 'guide', label: 'Guide', icon: BookOpenIcon, color: 'blue' },
  { value: 'roster', label: 'Roster', icon: ClipboardDocumentListIcon, color: 'purple' },
  { value: 'policy', label: 'Policy', icon: ShieldCheckIcon, color: 'orange' },
  { value: 'other', label: 'Other', icon: PaperClipIcon, color: 'gray' },
] as const;

const FEEDBACK_META: Record<string, { label: string; badge: string }> = {
  commendation: { label: 'Commendation', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  poor_performance: { label: 'Poor Performance', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  strike: { label: 'Strike', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  demotion_recommendation: { label: 'Demotion Rec.', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

const FEEDBACK_META_FALLBACK = { label: 'Feedback', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
function feedbackMeta(type: string) {
  return FEEDBACK_META[type] ?? FEEDBACK_META_FALLBACK;
}

function UploadDocumentModal({
  open,
  setOpen,
  groupId,
  teamId,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  teamId: string;
  onDone: () => void;
}) {
  const [uploadMode, setUploadMode] = useState<'link' | 'file'>('link');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileData, setFileData] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'guide' | 'roster' | 'policy' | 'other'>('other');
  const [uploading, setUploading] = useState(false);
  const uploadDoc = trpc.workspaces.workspace.teams.documents.upload.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fileName) setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileData(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const isValid = fileName.trim() && (uploadMode === 'link' ? fileUrl.trim() : !!fileData);

  const handleUpload = async () => {
    if (!isValid) return;
    setUploading(true);
    try {
      await toast.promise(
        uploadDoc.mutateAsync({
          groupId,
          teamId,
          fileName: fileName.trim(),
          fileUrl: uploadMode === 'link' ? fileUrl.trim() : undefined,
          fileData: uploadMode === 'file' ? (fileData ?? undefined) : undefined,
          fileSize: 0,
          category,
          description: description.trim(),
        }),
        {
          loading: uploadMode === 'file' ? 'Uploading file...' : 'Saving document...',
          success: 'Document added!',
          error: (e: any) => e?.message ?? 'Failed.',
        },
      );
      setFileName(''); setFileUrl(''); setFileData(null); setDescription(''); setCategory('other');
      setOpen(false);
      onDone();
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setUploadMode('link'); setFileName(''); setFileUrl(''); setFileData(null); setDescription(''); setCategory('other');
  };

  return (
    <Modal open={open} setOpen={(v: boolean) => { if (!v) reset(); setOpen(v); }} sizeOverride="md">
      <div className="px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Add Document</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Share a link or upload a file with your team.</p>

        {/* Mode switcher */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-5 w-fit">
          {(['link', 'file'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setUploadMode(mode)}
              className={`px-5 py-2 text-sm font-medium transition ${uploadMode === mode ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {mode === 'link' ? '🔗 Link' : '📁 Upload File'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g., Team Handbook, Onboarding Guide"
              autoFocus
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {uploadMode === 'link' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://docs.google.com/... or any link"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File <span className="text-red-500">*</span></label>
              <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-lg py-6 px-4 cursor-pointer transition ${fileData ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}>
                <input type="file" className="hidden" onChange={handleFileSelect} />
                {fileData ? (
                  <>
                    <span className="text-2xl">✅</span>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{fileName || 'File selected'}</span>
                    <span className="text-xs text-gray-500">Click to change file</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📂</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to select a file</span>
                    <span className="text-xs text-gray-400">Any file type • Uploaded to team CDN</span>
                  </>
                )}
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {DOC_CATEGORIES.map((cat) => {
                const active = category === cat.value;
                const colorMap: Record<string, string> = {
                  blue: active ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-500',
                  purple: active ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500',
                  orange: active ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-gray-700 text-gray-500',
                  gray: active ? 'border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'border-gray-200 dark:border-gray-700 text-gray-500',
                };
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition ${colorMap[cat.color]}`}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this document about?"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
          <Button variant="primary" onClick={handleUpload} disabled={uploading || !isValid}>
            {uploading ? 'Uploading...' : 'Add Document'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type MemberItem = TeamDetail['members'][number];

function MemberDetailDrawer({
  open,
  setOpen,
  member,
  team,
  groupId,
  canManage,
  onGiveFeedback,
  onRemove,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  member: MemberItem | null;
  team: TeamDetail;
  groupId: string;
  canManage: boolean;
  onGiveFeedback: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const userId = member?.userId ?? '';
  const { data: feedback, isLoading } = trpc.workspaces.workspace.teams.feedback.getForUser.useQuery(
    { groupId, userId },
    { enabled: open && !!userId && canManage },
  );
  const role = member ? team.roles.find((r) => r.id === member.roleId) : null;
  const isLinked = member ? !(member as any)._id : false;

  return (
    <SlideOutDrawer open={open} setOpen={setOpen} title="Member Details" size="md">
      {member && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href={`/workspaces/${groupId}/users/${member.userId}`} target="_blank" className="shrink-0">
              <HeadshotForUserId userId={member.userId} size={64} />
            </Link>
            <div className="min-w-0">
              <Link
                href={`/workspaces/${groupId}/users/${member.userId}`}
                target="_blank"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate block hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                <TextReturnForUserId userId={member.userId} />
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {role?.name ?? 'Unknown Role'}
                </span>
                {role?.isLead && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">★ Lead</span>}
                {isLinked && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">Linked</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="blue" size="small" className="w-full justify-center sm:w-auto" onClick={() => onGiveFeedback(member.userId)}>
              Give Feedback
            </Button>
            <Link
              href={`/workspaces/${groupId}/teams/feedback/${member.userId}`}
              className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition sm:w-auto"
            >
              Full feedback history →
            </Link>
            {canManage && !isLinked && (
              <Button variant="light_danger" icon={UserMinusIcon} size="small" className="w-full justify-center sm:w-auto" onClick={() => { setOpen(false); onRemove(member.userId); }}>
                Remove from team
              </Button>
            )}
          </div>

          {/* Feedback */}
          {canManage && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Recent Feedback</h3>
              {isLoading ? (
                <p className="text-sm text-gray-400">Loading feedback...</p>
              ) : !feedback || feedback.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No feedback on record.</p>
              ) : (
                <div className="space-y-2">
                  {feedback.slice(0, 8).map((fb: any) => {
                    const meta = feedbackMeta(fb.type as string);
                    return (
                      <div key={fb._id?.toString()} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                          {fb.created && <span className="text-xs text-gray-400"><ReactTimeago date={new Date(fb.created)} /></span>}
                        </div>
                        {fb.note && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 wrap-break-word">{fb.note}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </SlideOutDrawer>
  );
}

export default function TeamDetailPage() {
  const router = useRouter();
  const { groupId, teamId } = router.query as { groupId: string; teamId: string };
  const workspace = useWorkspace();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [memberPage, setMemberPage] = useState(0);
  const [docCategory, setDocCategory] = useState<string>('all');
  const [confirm, ConfirmDialog] = useConfirm();

  const { data: team, refetch } = trpc.workspaces.workspace.teams.teams.getById.useQuery(
    { groupId, teamId },
    { enabled: !!groupId && !!teamId },
  );
  const { data: documents, refetch: refetchDocs } = trpc.workspaces.workspace.teams.documents.getDocuments.useQuery(
    { groupId, teamId },
    { enabled: !!groupId && !!teamId },
  );
  const perms = workspace?.department.permissions;
  // Editing this team is allowed for admins, manage-all, or a lead of this team.
  const canManagePerm = !!team?.viewerCanManage;
  const canApprovePerm = !!(perms?.admin || perms?.teams?.approve);
  const { data: teamFeedback } = trpc.workspaces.workspace.teams.feedback.getByTeam.useQuery(
    { groupId, teamId },
    { enabled: !!groupId && !!teamId && canManagePerm },
  );
  const { data: pendingExpenses } = trpc.workspaces.workspace.teams.expenses.getPendingApprovals.useQuery(
    { groupId },
    { enabled: !!groupId && canApprovePerm },
  );
  const { data: pendingTimeOff } = trpc.workspaces.workspace.teams.timeOff.getPendingApprovals.useQuery(
    { groupId },
    { enabled: !!groupId && canApprovePerm },
  );
  const removeMember = trpc.workspaces.workspace.teams.members.removeMember.useMutation();
  const updateMemberRole = trpc.workspaces.workspace.teams.members.updateMemberRole.useMutation();
  const deleteTeam = trpc.workspaces.workspace.teams.teams.delete.useMutation();
  const togglePinMutation = trpc.workspaces.workspace.teams.documents.togglePin.useMutation();
  const deleteDocMutation = trpc.workspaces.workspace.teams.documents.delete.useMutation();

  if (!workspace || !team) return <LoadingPage />;

  const canManage = !!team.viewerCanManage;
  const canApprove = workspace.department.permissions.admin || workspace.department.permissions.teams?.approve || workspace.department.permissions.teams?.manage;
  const canRequestExpense = workspace.teamsSettings?.allowMemberExpenseRequests !== false || canApprove;

  const memberSearchLower = memberSearch.trim().toLowerCase();
  const filteredMembers = team.members.filter((member) => {
    if (roleFilter && member.roleId !== roleFilter) return false;
    if (memberSearchLower) {
      const name = ((member as any).username ?? '').toLowerCase();
      const display = ((member as any).displayName ?? '').toLowerCase();
      if (!name.includes(memberSearchLower) && !display.includes(memberSearchLower) && !member.userId.includes(memberSearchLower)) {
        return false;
      }
    }
    return true;
  });

  // Paginate so we never fire hundreds/thousands of headshot + username requests at once.
  const MEMBERS_PER_PAGE = 50;
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const safeMemberPage = Math.min(memberPage, memberPageCount - 1);
  const pagedMembers = filteredMembers.slice(
    safeMemberPage * MEMBERS_PER_PAGE,
    safeMemberPage * MEMBERS_PER_PAGE + MEMBERS_PER_PAGE,
  );

  const docList = documents ?? [];
  const filteredDocs = docCategory === 'all' ? docList : docList.filter((d: any) => d.category === docCategory);
  const docCounts: Record<string, number> = docList.reduce((acc: Record<string, number>, d: any) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  const pendingForTeam = canApprovePerm
    ? [...(pendingExpenses ?? []), ...(pendingTimeOff ?? [])].filter((r: any) => r.teamId?.toString() === teamId).length
    : 0;
  const recentFeedback = (teamFeedback ?? []).slice(0, 5);

  const handleRemoveMember = async (userId: string) => {
    if (!(await confirm({ title: 'Remove member', body: 'Remove this member from the team?', confirmText: 'Remove', destructive: true }))) return;
    await toast.promise(
      removeMember.mutateAsync({ groupId, teamId, userId }),
      { loading: 'Removing...', success: 'Member removed.', error: (e) => e?.message ?? 'Failed.' },
    );
    refetch();
  };

  const handleDeleteTeam = async () => {
    if (!(await confirm({ title: `Delete “${team.name}”?`, body: 'Members will be removed and any sub-teams will be re-parented. This cannot be undone.', confirmText: 'Delete Team', destructive: true }))) return;
    await toast.promise(
      deleteTeam.mutateAsync({ groupId, teamId }),
      { loading: 'Deleting...', success: 'Team deleted.', error: (e) => e?.message ?? 'Failed.' },
    );
    router.push(`/workspaces/${groupId}/teams`);
  };

  return (
    <>
      <div className="mb-8">
        <PageHeading
          title={team.name}
          description={team.description ?? 'No description provided'}
        />
        <div className="flex flex-wrap items-center gap-2 mt-5 px-6">
          {canManage && (
            <Button variant="primary" icon={PlusIcon} onClick={() => setAddMemberOpen(true)}>
              Add Member
            </Button>
          )}
          {canRequestExpense && (
            <Button variant="discrete" icon={CurrencyDollarIcon} onClick={() => router.push(`/workspaces/${groupId}/teams/requests`)}>
              Request Expense
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="discrete" icon={PencilIcon} onClick={() => router.push(`/workspaces/${groupId}/teams/${teamId}/settings`)}>
                Team Settings
              </Button>
              <Button variant="discrete_danger" icon={TrashIcon} className="ml-auto" onClick={handleDeleteTeam}>
                Delete Team
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Members</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{team.members.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Roles</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{team.roles.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Leads</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{team.roles.filter(r => r.isLead).length}</p>
          </div>
          {canApprovePerm && (
            <div className={`rounded-lg border p-4 ${pendingForTeam > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Pending Requests</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${pendingForTeam > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{pendingForTeam}</p>
                {pendingForTeam > 0 && (
                  <button onClick={() => router.push(`/workspaces/${groupId}/teams/requests`)} className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline">Review →</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent Feedback (managers only) */}
        {canManage && recentFeedback.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Feedback</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Latest commendations and performance notes for this team</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              {recentFeedback.map((fb: any) => {
                const meta = feedbackMeta(fb.type as string);
                return (
                  <div key={fb._id?.toString()} className="flex items-start gap-3">
                    <HeadshotForUserId userId={fb.toUserId} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          <TextReturnForUserId userId={fb.toUserId} />
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                        {fb.created && <span className="text-xs text-gray-400"><ReactTimeago date={new Date(fb.created)} /></span>}
                      </div>
                      {fb.note && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 wrap-break-word">{fb.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Roles */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Team Roles</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Define responsibilities and hierarchy</p>
            </div>
            {canManage && (
              <Button
                variant="discrete"
                size="small"
                icon={PlusIcon}
                onClick={() => router.push(`/workspaces/${groupId}/teams/${teamId}/settings`)}
              >
                Manage
              </Button>
            )}
          </div>
          <div className="px-6 py-4">
            {team.roles.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No roles yet. Create one in team settings.</p>
            ) : (
              <div className="space-y-2">
                {team.roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{role.name}</p>
                      {role.isLead && <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">★ Team Lead</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      role.isLead
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {team.members.filter(m => m.roleId === role.id).length} member{team.members.filter(m => m.roleId === role.id).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Members list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Team Members</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</p>
            </div>
            {canManage && (
              <Button variant="primary" size="small" icon={PlusIcon} onClick={() => setAddMemberOpen(true)}>
                Add Member
              </Button>
            )}
          </div>
          {team.members.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(0); }}
                  placeholder="Search members..."
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {team.roles.length > 1 && (
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setMemberPage(0); }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All roles</option>
                  {team.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div className="px-6 py-4">
            {team.members.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
                <UsersIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">No members in this team yet</p>
                {canManage && (
                  <Button variant="primary" icon={PlusIcon} size="small" onClick={() => setAddMemberOpen(true)}>
                    Add First Member
                  </Button>
                )}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
                <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">No members match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pagedMembers.map((member) => {
                  const role = team.roles.find((r) => r.id === member.roleId);
                  const isLinked = !(member as any)._id;
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500 transition"
                    >
                      <button
                        type="button"
                        onClick={() => setDrawerUserId(member.userId)}
                        className="flex items-center gap-4 flex-1 min-w-0 text-left"
                      >
                        <HeadshotForUserId userId={member.userId} size={40} />
                        <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition">
                          <TextReturnForUserId userId={member.userId} />
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {role?.name ?? 'Unknown Role'}
                          </span>
                          {role?.isLead && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">★ Lead</span>}
                          {isLinked && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300" title="Added automatically via a linked Roblox role or department">
                              Linked
                            </span>
                          )}
                        </div>
                      </div>
                      </button>
                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="blue"
                            size="small"
                            onClick={() => setFeedbackTarget(member.userId)}
                          >
                            Feedback
                          </Button>
                          {!isLinked && team.roles.length > 1 && (
                            <select
                              value={member.roleId}
                              onChange={async (e) => {
                                await toast.promise(
                                  updateMemberRole.mutateAsync({ groupId, teamId, userId: member.userId, roleId: e.target.value }),
                                  { loading: 'Updating...', success: 'Updated!', error: (err: any) => err?.message ?? 'Failed.' },
                                );
                                refetch();
                              }}
                              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 py-1 px-2"
                            >
                              {team.roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          )}
                          {!isLinked && (
                            <Button
                              variant="light_danger"
                              icon={UserMinusIcon}
                              size="small"
                              onClick={() => handleRemoveMember(member.userId)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {filteredMembers.length > MEMBERS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {safeMemberPage * MEMBERS_PER_PAGE + 1}–{Math.min((safeMemberPage + 1) * MEMBERS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="discrete"
                    size="small"
                    disabled={safeMemberPage <= 0}
                    onClick={() => setMemberPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {safeMemberPage + 1} of {memberPageCount}
                  </span>
                  <Button
                    variant="discrete"
                    size="small"
                    disabled={safeMemberPage >= memberPageCount - 1}
                    onClick={() => setMemberPage((p) => Math.min(memberPageCount - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documents Hub */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Document Hub</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Share guides, rosters, and policies with your team</p>
            </div>
            {canManage && (
              <Button variant="primary" size="small" icon={PlusIcon} onClick={() => setUploadDocOpen(true)}>
                Upload
              </Button>
            )}
          </div>
          {docList.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
              <button
                onClick={() => setDocCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${docCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                All ({docList.length})
              </button>
              {DOC_CATEGORIES.map((cat) => {
                const count = docCounts[cat.value] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setDocCategory(cat.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${docCategory === cat.value ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-6 py-4">
            {(!documents || documents.length === 0) ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
                <DocumentIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">No documents yet</p>
                {canManage && (
                  <Button variant="primary" icon={PlusIcon} size="small" onClick={() => setUploadDocOpen(true)}>
                    Upload First Document
                  </Button>
                )}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
                <DocumentIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">No documents in this category.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc: any) => (
                  <div
                    key={doc._id?.toString()}
                    className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500 transition group"
                  >
                    <div className="shrink-0 mt-0.5">
                      {(() => {
                        const cat = DOC_CATEGORIES.find(c => c.value === doc.category) ?? DOC_CATEGORIES[3];
                        const iconColorMap: Record<string, string> = { blue: 'text-blue-500', purple: 'text-purple-500', orange: 'text-orange-500', gray: 'text-gray-400' };
                        return <cat.icon className={`w-5 h-5 ${iconColorMap[cat.color]}`} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 wrap-break-word"
                        >
                          {doc.fileName}
                        </a>
                        {doc.pinned && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">📌 Pinned</span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded text-xs">{doc.category}</span>
                        {doc.uploadedAt && <><span>•</span><ReactTimeago date={new Date(doc.uploadedAt)} /></>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <Button
                          variant="discrete"
                          size="small"
                          onClick={async () => {
                            await toast.promise(
                              togglePinMutation.mutateAsync({ groupId, teamId, documentId: doc._id?.toString() }),
                              { loading: doc.pinned ? 'Unpinning...' : 'Pinning...', success: doc.pinned ? 'Unpinned.' : 'Pinned!', error: (e: any) => e?.message ?? 'Failed.' },
                            );
                            refetchDocs();
                          }}
                          disabled={togglePinMutation.isPending}
                        >
                          {doc.pinned ? 'Unpin' : 'Pin'}
                        </Button>
                        <Button
                          variant="light_danger"
                          size="small"
                          icon={TrashIcon}
                          onClick={async () => {
                            if (!(await confirm({ title: 'Delete document', body: 'Delete this document? This cannot be undone.', confirmText: 'Delete', destructive: true }))) return;
                            await toast.promise(
                              deleteDocMutation.mutateAsync({ groupId, teamId, documentId: doc._id?.toString() }),
                              { loading: 'Deleting...', success: 'Deleted.', error: (e: any) => e?.message ?? 'Failed.' },
                            );
                            refetchDocs();
                          }}
                          disabled={deleteDocMutation.isPending}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <UploadDocumentModal
          open={uploadDocOpen}
          setOpen={setUploadDocOpen}
          groupId={groupId}
          teamId={teamId}
          onDone={refetchDocs}
        />
      )}

      {canManage && team && (
        <AddMemberModal
          open={addMemberOpen}
          setOpen={setAddMemberOpen}
          groupId={groupId}
          team={team}
          onDone={refetch}
        />
      )}

      {feedbackTarget && (
        <GiveFeedbackModal
          open={!!feedbackTarget}
          setOpen={(v) => !v && setFeedbackTarget(null)}
          groupId={groupId}
          teamId={teamId}
          targetUserId={feedbackTarget}
          onDone={refetch}
        />
      )}

      <MemberDetailDrawer
        open={!!drawerUserId}
        setOpen={(v) => !v && setDrawerUserId(null)}
        member={drawerUserId ? team.members.find((m) => m.userId === drawerUserId) ?? null : null}
        team={team}
        groupId={groupId}
        canManage={canManage}
        onGiveFeedback={(uid) => { setDrawerUserId(null); setFeedbackTarget(uid); }}
        onRemove={handleRemoveMember}
      />

      {ConfirmDialog}
    </>
  );
}

TeamDetailPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Teams" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
