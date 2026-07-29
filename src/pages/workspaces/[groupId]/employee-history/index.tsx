/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter } from 'next/router';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import {
    ArrowUpCircleIcon,
    ArrowDownCircleIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    NoSymbolIcon,
    TrashIcon,
    CheckIcon,
    MagnifyingGlassIcon,
    ClipboardDocumentListIcon,
    PaperClipIcon,
    PlusIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon,
    ArrowDownTrayIcon,
    DocumentIcon,
    ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import Button from '~/components/forms/Button';
import Modal from '~/components/ui/Modal';
import CreateEmployeeHistoryModal from '~/components/page_components/workspaces/employee-history/CreateHistory.modal';

type LogType = 'promotion' | 'demotion' | 'writeup' | 'suspension' | 'termination';

const TYPE_VISUALS: Record<LogType, {
    label: string;
    icon: typeof ArrowUpCircleIcon;
    iconClass: string;
    tint: string;
    badge: string;
}> = {
    promotion: { label: 'Promotion', icon: ArrowUpCircleIcon, iconClass: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-900/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    demotion: { label: 'Demotion', icon: ArrowDownCircleIcon, iconClass: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    writeup: { label: 'Write Up', icon: ExclamationTriangleIcon, iconClass: 'text-yellow-500', tint: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    suspension: { label: 'Suspension', icon: ClockIcon, iconClass: 'text-orange-500', tint: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    termination: { label: 'Termination', icon: NoSymbolIcon, iconClass: 'text-red-500', tint: 'bg-red-50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const FILTERS: { value: 'all' | LogType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'promotion', label: 'Promotions' },
    { value: 'demotion', label: 'Demotions' },
    { value: 'writeup', label: 'Write Ups' },
    { value: 'suspension', label: 'Suspensions' },
    { value: 'termination', label: 'Terminations' },
];

type HistoryRecord = {
    id: string;
    type: LogType;
    recipient: getProcessedUserObjectType;
    actioner: getProcessedUserObjectType;
    reason: string;
    rankTo: string | false;
    distribution?: string | number;
    expires?: string | number | Date;
    created: string | number | Date;
    evidence: string[];
    pendingApproval: boolean;
    reasonHidden?: boolean;
};

function UserChip({ groupId, user, label }: { groupId: string; user: getProcessedUserObjectType; label: string }) {
    return (
        <Link
            href={`/workspaces/${groupId}/users/${user.id}`}
            target="_blank"
            className="group flex items-center gap-2.5 rounded-lg p-1.5 pr-3 transition hover:bg-gray-100 dark:hover:bg-gray-700"
        >
            <img
                className="h-9 w-9 rounded-full bg-gray-100 object-cover dark:bg-gray-700"
                src={user.thumbnail}
                alt={user.name}
            />
            <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
                <p className="truncate text-sm font-medium text-gray-900 group-hover:underline dark:text-gray-100">
                    {user.name || 'Unknown'}
                    {user.displayName && user.displayName !== user.name && (
                        <span className="ml-1 font-normal text-gray-400">({user.displayName})</span>
                    )}
                </p>
            </div>
        </Link>
    );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{children}</span>
        </div>
    );
}

function attachmentFileName(attachment: string): string {
    return (
        attachment.substring(
            // @ts-expect-error mirrors existing Attachment helper
            attachment.indexOf(attachment.split('-')[5]),
        )?.split('?')[0] || 'file'
    );
}

function isImageAttachment(attachment: string): boolean {
    const ext = attachmentFileName(attachment).split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

function Lightbox({
    images,
    index,
    onClose,
    onNavigate,
}: {
    images: string[];
    index: number;
    onClose: () => void;
    onNavigate: (next: number) => void;
}) {
    const touchStartX = useRef<number | null>(null);
    const hasMultiple = images.length > 1;
    const currentImage = images[index] || '';

    const goPrev = () => onNavigate((index - 1 + images.length) % images.length);
    const goNext = () => onNavigate((index + 1) % images.length);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft' && hasMultiple) goPrev();
            else if (e.key === 'ArrowRight' && hasMultiple) goNext();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, images.length]);

    return (
        <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={onClose}
            onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
                if (touchStartX.current === null || !hasMultiple) return;
                const endX = e.changedTouches[0]?.clientX;
                if (endX === undefined) { touchStartX.current = null; return; }
                const delta = endX - touchStartX.current;
                if (delta > 50) goPrev();
                else if (delta < -50) goNext();
                touchStartX.current = null;
            }}
        >
            <button
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close"
            >
                <XMarkIcon className="h-6 w-6" />
            </button>

            {hasMultiple && (
                <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 sm:left-6"
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    aria-label="Previous"
                >
                    <ChevronLeftIcon className="h-7 w-7" />
                </button>
            )}

            <div className="flex max-h-full max-w-5xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <img
                    src={currentImage}
                    alt={attachmentFileName(currentImage)}
                    className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
                />
                <div className="flex items-center gap-3 text-sm text-white/80">
                    {hasMultiple && <span>{index + 1} / {images.length}</span>}
                    <a
                        href={currentImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 transition hover:bg-white/20"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" /> Open original
                    </a>
                </div>
            </div>

            {hasMultiple && (
                <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 sm:right-6"
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    aria-label="Next"
                >
                    <ChevronRightIcon className="h-7 w-7" />
                </button>
            )}
        </div>
    );
}

function EvidenceGallery({ evidence }: { evidence: string[] }) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const images = useMemo(() => evidence.filter(isImageAttachment), [evidence]);
    const files = useMemo(() => evidence.filter((a) => !isImageAttachment(a)), [evidence]);

    return (
        <div className="mt-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                <PaperClipIcon className="h-3.5 w-3.5" />
                Evidence ({evidence.length})
            </div>
            <div className="flex flex-row flex-wrap gap-2">
                {images.map((attachment, i) => (
                    <button
                        key={attachment}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="group relative h-20 w-28 overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-md dark:border-gray-700"
                    >
                        <img
                            src={attachment}
                            alt={attachmentFileName(attachment)}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                    </button>
                ))}
                {files.map((attachment) => (
                    <a
                        key={attachment}
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 p-2 text-center transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900/40"
                    >
                        <DocumentIcon className="h-7 w-7 text-gray-400" />
                        <span className="w-full truncate text-xs text-blue-600 dark:text-blue-400">{attachmentFileName(attachment)}</span>
                    </a>
                ))}
            </div>

            {lightboxIndex !== null && images.length > 0 && (
                <Lightbox
                    images={images}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={setLightboxIndex}
                />
            )}
        </div>
    );
}

function HistoryCard({
    record,
    groupId,
    canDelete,
    canApprove,
    onDelete,
    onApprove,
    approving,
}: {
    record: HistoryRecord;
    groupId: string;
    canDelete: boolean;
    canApprove: boolean;
    onDelete: () => void;
    onApprove: () => void;
    approving: boolean;
}) {
    const visual = TYPE_VISUALS[record.type];
    const Icon = visual.icon;
    const showRankTo = record.type === 'promotion' || record.type === 'demotion';

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-4 p-4 sm:p-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${visual.tint}`}>
                    <Icon className={`h-6 w-6 ${visual.iconClass}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${visual.badge}`}>
                            {visual.label}
                        </span>
                        {record.pendingApproval && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                Pending Approval
                            </span>
                        )}
                        <span className="text-xs text-gray-400">
                            <ReactTimeago date={record.created} />
                        </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <UserChip groupId={groupId} user={record.recipient} label="Recipient" />
                        <UserChip groupId={groupId} user={record.actioner} label="Issued by" />
                    </div>

                    {record.reason ? (
                        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                            {record.reason}
                        </p>
                    ) : record.reasonHidden ? (
                        <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm italic text-gray-400 dark:bg-gray-900/50 dark:text-gray-500">
                            Reason hidden — you don’t have permission to view it.
                        </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        {showRankTo && record.rankTo !== false && (
                            <MetaItem label="Rank To">{record.rankTo}</MetaItem>
                        )}
                        {record.distribution && <MetaItem label="Distribution">{record.distribution}</MetaItem>}
                        {record.expires && (
                            <MetaItem label="Expires"><ReactTimeago date={record.expires} /></MetaItem>
                        )}
                    </div>

                    {record.evidence?.length > 0 && (
                        <EvidenceGallery evidence={record.evidence} />
                    )}
                </div>

                {(canDelete || (canApprove && record.pendingApproval)) && (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                        {canApprove && record.pendingApproval && (
                            <Button
                                variant="success"
                                icon={CheckIcon}
                                disabled={approving}
                                onClick={onApprove}
                            >
                                Approve
                            </Button>
                        )}
                        {canDelete && (
                            <Button variant="light_danger" icon={TrashIcon} onClick={onDelete} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function CardSkeleton() {
    return (
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-3">
                    <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="grid grid-cols-2 gap-2">
                        <div className="h-10 rounded bg-gray-100 dark:bg-gray-700" />
                        <div className="h-10 rounded bg-gray-100 dark:bg-gray-700" />
                    </div>
                    <div className="h-12 rounded bg-gray-100 dark:bg-gray-700" />
                </div>
            </div>
        </div>
    );
}

export default function EmployeeHistoryPage() {
    const router = useRouter();
    const { groupId }: { groupId: string } = router.query as any;
    const workspace = useWorkspace();

    const context = trpc.useUtils();
    const { data: history, isLoading } = trpc.workspaces.workspace.history.getHistory.useQuery(
        { groupId },
        { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false },
    );

    const deleteHistory = trpc.workspaces.workspace.history.deleteHistory.useMutation();
    const approveHistory = trpc.workspaces.workspace.history.approvePunishment.useMutation();

    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | LogType>('all');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
    const [pendingDelete, setPendingDelete] = useState<HistoryRecord | null>(null);

    const permissions = workspace?.department?.permissions?.writeUps;
    const canDelete = !!permissions?.delete;
    const canApprove = !!permissions?.approver;

    const records: HistoryRecord[] = useMemo(() => {
        return (history || []).map((logItem) => ({
            id: logItem._id.toString(),
            type: logItem.type as LogType,
            recipient: logItem.userInfo as getProcessedUserObjectType,
            actioner: logItem.punisherInfo as getProcessedUserObjectType,
            reason: logItem.reason,
            rankTo: logItem.rankTo == false
                ? false
                : workspace?.roles?.find((role) => role.id.toString() === (logItem?.rankTo || '').toString())?.name || 'Unknown Role',
            distribution: logItem.distribution,
            expires: logItem.expires,
            created: logItem.created,
            evidence: logItem.evidence || [],
            pendingApproval: !!logItem.pendingApproval,
            reasonHidden: !!(logItem as any).reasonHidden,
        }));
    }, [history, workspace?.roles]);

    const pendingCount = useMemo(() => records.filter((r) => r.pendingApproval).length, [records]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = records.filter((r) => {
            if (filter !== 'all' && r.type !== filter) return false;
            if (!q) return true;
            return (
                r.recipient?.name?.toLowerCase().includes(q) ||
                r.recipient?.displayName?.toLowerCase().includes(q) ||
                r.actioner?.name?.toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q)
            );
        });
        result.sort((a, b) => {
            const diff = new Date(a.created).getTime() - new Date(b.created).getTime();
            return sort === 'newest' ? -diff : diff;
        });
        return result;
    }, [records, search, filter, sort]);

    const handleApprove = (record: HistoryRecord) => {
        toast.promise(
            approveHistory
                .mutateAsync({ groupId, punishmentId: record.id })
                .then(() => context.workspaces.workspace.history.getHistory.invalidate({ groupId })),
            { loading: 'Approving...', success: 'Approved!', error: 'Failed to approve' },
        );
    };

    const handleConfirmDelete = () => {
        if (!pendingDelete) return;
        const record = pendingDelete;
        setPendingDelete(null);
        toast.promise(
            deleteHistory
                .mutateAsync({ groupId, punishmentId: record.id })
                .then(() => context.workspaces.workspace.history.getHistory.invalidate({ groupId })),
            { loading: 'Deleting...', success: 'Deleted!', error: 'Failed to delete' },
        );
    };

    return (
        <>
            <PageHeading
                title={`${workspace?.groupName || ''} Staff History`}
                description="View and manage disciplinary actions, promotions, and other staff records."
            >
                <Button variant="primary" icon={PlusIcon} onClick={() => setCreating(true)}>
                    New Record
                </Button>
            </PageHeading>

            <div className="mx-auto max-w-4xl pb-24">
                {/* Controls */}
                <div className="sticky top-0 z-10 -mx-1 mb-4 bg-white/80 px-1 py-3 backdrop-blur dark:bg-gray-900/80">
                    <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or reason..."
                            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900/30"
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {FILTERS.map((f) => {
                            const active = filter === f.value;
                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setFilter(f.value)}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${active
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <ArrowsUpDownIcon className="h-3.5 w-3.5" />
                            {sort === 'newest' ? 'Newest first' : 'Oldest first'}
                        </button>
                    </div>
                </div>

                {/* Pending approval callout */}
                {canApprove && pendingCount > 0 && filter === 'all' && !search && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                        {pendingCount} record{pendingCount === 1 ? '' : 's'} awaiting your approval.
                    </div>
                )}

                {/* List */}
                {isLoading ? (
                    <div className="space-y-3">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
                        <ClipboardDocumentListIcon className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {records.length === 0 ? 'No staff records yet' : 'No records match your filters'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                            {records.length === 0
                                ? 'Create a record to start tracking staff history.'
                                : 'Try adjusting your search or filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((record) => (
                            <HistoryCard
                                key={record.id}
                                record={record}
                                groupId={groupId}
                                canDelete={canDelete}
                                canApprove={canApprove}
                                approving={approveHistory.isPending}
                                onApprove={() => handleApprove(record)}
                                onDelete={() => setPendingDelete(record)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Delete confirmation */}
            <Modal open={!!pendingDelete} setOpen={() => setPendingDelete(null)} sizeOverride="md">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                            <TrashIcon className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete record?</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                This will permanently remove the {pendingDelete ? TYPE_VISUALS[pendingDelete.type].label.toLowerCase() : 'record'} for{' '}
                                <span className="font-medium text-gray-700 dark:text-gray-200">{pendingDelete?.recipient?.name}</span>. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="discrete" onClick={() => setPendingDelete(null)}>Cancel</Button>
                        <Button variant="danger" icon={TrashIcon} onClick={handleConfirmDelete}>Delete</Button>
                    </div>
                </div>
            </Modal>

            <CreateEmployeeHistoryModal groupId={groupId} open={creating} setOpen={setCreating} showPastHistory={false} />
        </>
    );
}

EmployeeHistoryPage.getLayout = (page: ReactElement) => (
    <WorkspaceLayout>{page}</WorkspaceLayout>
);
