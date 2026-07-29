/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ReactTimeago from "react-timeago";
import {
    ArrowUpCircleIcon,
    ArrowDownCircleIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    NoSymbolIcon,
    ArrowLeftIcon,
    ChevronRightIcon,
    CheckIcon,
    XMarkIcon,
    PaperClipIcon,
    CloudArrowUpIcon,
} from "@heroicons/react/24/outline";
import { useWorkspace } from "~/components/contexts/workspace";
import Button from "~/components/forms/Button";
import TextArea from "~/components/forms/TextArea";
import Toggle from "~/components/forms/Toggle";
import DatePicker from "~/components/ui/DatePicker";
import GroupRolesDropdown from "~/components/ui/GroupRolesDropdown";
import Modal from "~/components/ui/Modal";
import RobloxUserSearch from "~/components/ui/RobloxUserSearch";
import ReadFile from "~/utils/FileReader";
import { trpc } from "~/utils/trpc";
import { RouterOutput } from "~/server/routers/_app";
import { getProcessedUserObjectType } from "~/services/roblox.service";

type LogType = "promotion" | "writeup" | "suspension" | "termination" | "demotion";

const TYPE_VISUALS: Record<LogType, { label: string; icon: typeof ArrowUpCircleIcon; iconClass: string; tint: string; }> = {
    promotion: { label: "Promotion", icon: ArrowUpCircleIcon, iconClass: "text-emerald-500", tint: "bg-emerald-50 dark:bg-emerald-900/20" },
    demotion: { label: "Demotion", icon: ArrowDownCircleIcon, iconClass: "text-amber-500", tint: "bg-amber-50 dark:bg-amber-900/20" },
    writeup: { label: "Write Up", icon: ExclamationTriangleIcon, iconClass: "text-yellow-500", tint: "bg-yellow-50 dark:bg-yellow-900/20" },
    suspension: { label: "Suspension", icon: ClockIcon, iconClass: "text-orange-500", tint: "bg-orange-50 dark:bg-orange-900/20" },
    termination: { label: "Termination", icon: NoSymbolIcon, iconClass: "text-red-500", tint: "bg-red-50 dark:bg-red-900/20" },
};

function Stepper({ steps, current }: { steps: string[]; current: number }) {
    return (
        <ol className="flex items-center gap-1.5">
            {steps.map((label, i) => {
                const active = i === current;
                const done = i < current;
                return (
                    <li key={label} className="flex items-center gap-1.5">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ${done ? "bg-blue-600 text-white" : active ? "border-2 border-blue-600 text-blue-600 dark:text-blue-400" : "border border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"}`}>
                            {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <span className={`hidden text-xs font-medium sm:block ${active ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>{label}</span>
                        {i < steps.length - 1 && <ChevronRightIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
                    </li>
                );
            })}
        </ol>
    );
}

function SelectedUserChip({ user }: { user: getProcessedUserObjectType }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
            <img src={user.thumbnail} alt={user.name} className="h-9 w-9 rounded-full bg-gray-200" />
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {user.name}
                    {user.displayName !== user.name ? <span className="font-normal text-gray-500 dark:text-gray-400"> ({user.displayName})</span> : null}
                </p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">ID: {user.id}</p>
            </div>
        </div>
    );
}

export default function CreateEmployeeHistoryModal({
    userId,
    groupId,
    open,
    setOpen,
    showPastHistory,
    jumpToCreating,
}: {
    userId?: string;
    groupId: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    showPastHistory?: boolean;
    jumpToCreating?: "promotion" | "writeup" | "suspension" | "termination" | 'demotion';
}) {
    const workspace = useWorkspace();
    const [selectedUser, setSelectedUser] = useState<false | getProcessedUserObjectType>(false);

    const [createData, setCreateData] = useState<
        | {
            page: 1;
            userId?: string;
        }
        | {
            userId: string;
            page: 2;
            history: RouterOutput["workspaces"]["workspace"]["history"]["getHistoryForUserId"];
        }
        | {
            page: 3;
            userId: string;
        }
        | {
            page: 4;
            userId: string;
            type: "promotion" | "writeup" | "suspension" | "termination" | 'demotion';
        }
        | false
    >({
        page: 1,
    });

    const context = trpc.useUtils();
    const getRobloxUserInfo = trpc.roblox.getRobloxUserProcesed.useMutation();
    const getHistory = trpc.workspaces.workspace.history.getHistoryForUserId.useMutation();
    const createHistory = trpc.workspaces.workspace.history.createHistory.useMutation();

    useEffect(() => {
        if (userId) {
            setCreateData(false);
            getRobloxUserInfo.mutateAsync({ userId }).then(async (data: getProcessedUserObjectType) => {
                setSelectedUser(data);
                if (showPastHistory) {
                    getHistory.mutateAsync({ groupId, userId }).then((history: any) => {
                        setCreateData({ userId: data.id.toString(), history, page: 2 });
                    });
                } else {
                    if (jumpToCreating) {
                        setCreateData({ userId: data.id.toString(), page: 4, type: jumpToCreating });
                    } else {
                        setCreateData({ userId: data.id.toString(), page: 3 });
                    }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setCreateData({ page: 1 });
            setSelectedUser(false);
        }
    }, [open]);

    if (createData == false) {
        return (
            <Modal open={open} setOpen={setOpen}>
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading user...</p>
                </div>
            </Modal>
        );
    }

    const loggingOptions = [];

    if (workspace?.department?.permissions?.writeUps?.promote || workspace?.department?.permissions?.admin) {
        loggingOptions.push({
            id: "promotion",
            name: "Promotion",
            description: "A promotion is a reward given to a user for their hard work and dedication to the workspace.",
        });
    }
    if (workspace?.department?.permissions?.writeUps?.demote || workspace?.department?.permissions?.admin) {
        loggingOptions.push({
            id: "demotion",
            name: "Demotion",
            description: "A demotion is a reduction in rank or position within the workspace.",
        });
    }
    if (workspace?.department?.permissions?.writeUps?.writeUps || workspace?.department?.permissions?.admin) {
        loggingOptions.push({
            id: "writeup",
            name: "Write Up",
            description: "A write up is a formal warning given to a user for breaking the rules of the workspace.",
        });
    }
    if (workspace?.department?.permissions?.writeUps?.suspensions || workspace?.department?.permissions?.admin) {
        loggingOptions.push({
            id: "suspension",
            name: "Suspension",
            description: "A suspension is a temporary ban from the workspace.",
        });
    }
    if (workspace?.department?.permissions?.writeUps?.terminations || workspace?.department?.permissions?.admin) {
        loggingOptions.push({
            id: "termination",
            name: "Termination",
            description: "A termination is a permanent ban from the workspace.",
        });
    }

    const ActionForm = ({
        title,
        notifyText,
        expiryRequired,
        promoteOption,
        demoteOption,
        expiryEnabled,
        submitText,
    }: {
        title?: string;
        notifyText?: string;
        expiryEnabled?: boolean;
        expiryRequired?: boolean;
        promoteOption?: boolean;
        demoteOption?: boolean;
        submitText?: string;
    }) => {
        const [reason, setReason] = useState("");
        const [expires, setExpires] = useState<string | null>(null);
        const [notify, setNotify] = useState(true);
        const [demote, setDemote] = useState(false);
        const [role, setRole] = useState<string | null>(null);
        const [files, setFiles] = useState<FileList | null>(null);
        const [hideReason, setHideReason] = useState(false);
        const [hideEntire, setHideEntire] = useState(false);
        const visibility: 'public' | 'reasonHidden' | 'hidden' =
            hideEntire ? 'hidden' : hideReason ? 'reasonHidden' : 'public';

        const activeType = (createData as any).type as LogType;
        const visual = TYPE_VISUALS[activeType];
        const TypeIcon = visual?.icon;

        return (
            <div>
                <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
                    {TypeIcon && (
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.tint}`}>
                            <TypeIcon className={`h-6 w-6 ${visual.iconClass}`} />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                        {selectedUser && <p className="truncate text-xs text-gray-400 dark:text-gray-500">{visual?.label} &middot; ID {selectedUser.id}</p>}
                    </div>
                </div>
                <form
                    className="flex flex-col gap-2"
                    onSubmit={async (form) => {
                        form.preventDefault();
                        const type = (createData as any).type as "promotion" | "writeup" | "suspension" | "termination" | 'demotion';

                        const fileData: [string, string][] = [];
                        if (files) {
                            for (const file of Array.from(files)) {
                                const data = await ReadFile(file);
                                if (data) {
                                    fileData.push([file.name, data.toString()]);
                                }
                            }
                        }

                        let expiryDate: Date | null = null;
                        if (expires) {
                            expiryDate = new Date(expires);
                        }
                        setOpen(false);

                        const createPromise = new Promise<void>((resolve, reject) => {
                            createHistory
                                .mutateAsync({
                                    groupId,
                                    type,
                                    userId: createData?.userId?.toString() || "",
                                    reason,
                                    notify,
                                    role: (demote || promoteOption) ? (role || workspace.rankableRoles[0]?.rank || '')?.toString() : undefined,
                                    ...(expiryDate ? { expires: expiryDate } : {}),
                                    files: fileData,
                                    ...(visibility !== 'public' ? { visibility } : {}),
                                })
                                .then(() => {
                                    context.workspaces.workspace.history.getHistory.invalidate({ groupId });
                                    context.workspaces.workspace.history.getHistory.invalidate({ groupId, userId });

                                    setCreateData({
                                        page: 1,
                                    });
                                    resolve();
                                })
                                .catch((err) => {
                                    reject(err);
                                    context.workspaces.workspace.history.getHistory.invalidate({ groupId });
                                    context.workspaces.workspace.history.getHistory.invalidate({ groupId, userId });
                                    toast.error(err?.message || 'Something went wrong, please create a ticket.')
                                });
                        });

                        toast.promise(createPromise, {
                            loading: "Creating staff history...",
                            success: "Staff history creation successful (if you chose to rank someone, the user was also ranked successfully)",
                            error: "Failed to create staff history",
                        });
                    }}
                >
                    <TextArea
                        defaultValue={reason}
                        onBlur={setReason}
                        label="Reason"
                        id="reason"
                        rows={3}
                    />
                    {expiryEnabled !== false && (
                        <DatePicker
                            label="Expiry"
                            id="expires"
                            defaultValue={expires}
                            onChange={setExpires}
                            required={expiryRequired}
                            placeholder="Select expiry date"
                        />
                    )}
                    <Toggle
                        id="notify"
                        value={notify}
                        title="Notify user"
                        description={notifyText}
                        onChange={setNotify}
                    />
                    <Toggle
                        id="hideReason"
                        value={hideReason}
                        title="Hide reason"
                        description="Only staff with the “read hidden punishment reasons” permission can read the reason. (The user is still notified normally.)"
                        onChange={(v: boolean) => {
                            setHideReason(v);
                            if (!v) setHideEntire(false);
                        }}
                    />
                    {hideReason && (
                        <Toggle
                            id="hideEntire"
                            value={hideEntire}
                            title="Hide the entire record"
                            description="Hide the whole punishment (not just the reason) from staff without the permission."
                            onChange={setHideEntire}
                        />
                    )}
                    {promoteOption && (workspace.department.permissions.activity.ranking || workspace.department.permissions.admin) && (
                        <>
                            <GroupRolesDropdown
                                label="Promote to"
                                id="role"
                                userRankableOnly={workspace.department.permissions.admin ? false : true}
                                groupId={groupId}
                                onChange={(value: string) => { setRole(value); }}
                            />
                        </>
                    )}
                    {demoteOption && (workspace.department.permissions.activity.ranking || workspace.department.permissions.admin) && (
                        <>
                            <Toggle
                                id="role"
                                value={demote}
                                title="Demote user"
                                description="Demote the user to a selected role."
                                onChange={setDemote}
                            />
                            {demote && (
                                <GroupRolesDropdown
                                    label="Suspend to"
                                    id="role"
                                    userRankableOnly={workspace.department.permissions.admin ? false : true}
                                    groupId={groupId}
                                    onChange={(value: string) => { setRole(value) }}
                                />
                            )}
                        </>
                    )}
                    <div className="w-full">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                document.getElementById("files")?.click();
                            }}
                            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
                        >
                            <CloudArrowUpIcon className="h-6 w-6 text-gray-400" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Upload related media</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">PNG, JPEG or PDF</span>
                        </button>
                        <input
                            onChange={(f) => setFiles(f.target.files)}
                            type="file"
                            id="files"
                            className="hidden"
                            accept="image/png, image/jpeg, .pdf"
                            multiple
                        />
                        {files !== null && files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {Array.from(files).map((file) => {
                                    const isImage = file.type.startsWith("image/");
                                    return (
                                        <div key={file.name} className="group relative flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                                            {isImage ? (
                                                <img className="h-8 w-8 rounded-md object-cover" src={URL.createObjectURL(file)} alt={file.name} />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                                                    <PaperClipIcon className="h-4 w-4 text-gray-400" />
                                                </div>
                                            )}
                                            <span className="max-w-32 truncate text-xs font-medium text-gray-600 dark:text-gray-300">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const dt = new DataTransfer();
                                                    Array.from(files).filter((f) => f.name !== file.name).forEach((f) => dt.items.add(f));
                                                    setFiles(dt.files.length ? dt.files : null);
                                                }}
                                                className="rounded-full p-0.5 text-gray-400 transition hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30"
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                <XMarkIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {workspace?.department?.permissions?.writeUps?.approval_required &&
                        !workspace?.department?.permissions?.writeUps?.approver && (
                            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    This log will need approval from someone with the &quot;Allow user to approve
                                    punishment requests&quot; permission before it takes effect.
                                </p>
                            </div>
                        )}

                    <div className="mt-3 flex flex-row justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                        <Button
                            variant="discrete"
                            icon={ArrowLeftIcon}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCreateData({
                                    ...createData,
                                    //@ts-expect-error cope
                                    page: 3,
                                });
                            }}
                            size="medium"
                        >
                            Back
                        </Button>
                        <Button className="grow" variant="primary" icon={CheckIcon} size="medium">
                            {submitText || "Submit"}
                        </Button>
                    </div>
                </form>
            </div>
        );
    };

    return (
        <Modal open={open} setOpen={setOpen}>
            <>
                {createData.page == 1 && (
                    <div className="flex flex-col gap-4">
                        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create staff history</h2>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Search for the staff member you want to log an action for.</p>
                            <div className="mt-3">
                                <Stepper steps={showPastHistory ? ["User", "History", "Type", "Details"] : ["User", "Type", "Details"]} current={0} />
                            </div>
                        </div>

                        <RobloxUserSearch
                            size="small"
                            color={workspace?.brandColor || 'blue'}
                            placeholder="Who do you want to create a log for?"
                            groupId={groupId}
                            onSelectUser={(userId) => {
                                getRobloxUserInfo.mutateAsync({ userId }).then(async (data: getProcessedUserObjectType) => {
                                    setSelectedUser(data);
                                    setCreateData({ userId: data.id.toString(), page: 1 });
                                });
                            }}
                        />

                        {selectedUser && (
                            <div className="fade-in animate-in slide-in-from-top flex flex-col gap-3">
                                <SelectedUserChip user={selectedUser} />
                                <Button
                                    variant="primary"
                                    icon={ChevronRightIcon}
                                    className="w-full"
                                    onClick={() => {
                                        if (showPastHistory) {
                                            getHistory.mutateAsync({ groupId, userId: createData.userId }).then((history: any) => {
                                                //@ts-expect-error cope
                                                setCreateData({ ...createData, history, page: 2 });
                                            });
                                        } else {
                                            //@ts-expect-error cope
                                            setCreateData({ ...createData, page: 3 });
                                        }
                                    }}
                                >
                                    Continue
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {createData.page == 2 && (
                    <div className="flex flex-col gap-4">
                        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Past history</h2>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Review {selectedUser ? selectedUser.name : "this user"}&apos;s previous records before logging a new one.</p>
                            <div className="mt-3">
                                <Stepper steps={["User", "History", "Type", "Details"]} current={1} />
                            </div>
                        </div>

                        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                            {createData?.history?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 px-6 py-8 text-center dark:border-gray-700">
                                    <ClockIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No history found</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">This user has a clean record.</p>
                                </div>
                            ) : (
                                createData?.history?.map((logItem) => {
                                    const v = TYPE_VISUALS[logItem.type as LogType];
                                    const LogIcon = v?.icon;
                                    return (
                                        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800/40" key={logItem._id.toString()}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${v?.tint} ${v?.iconClass}`}>
                                                    {LogIcon && <LogIcon className="h-3.5 w-3.5" />}
                                                    {v?.label || logItem.type}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    <ReactTimeago date={logItem.created} />
                                                    {logItem.distribution ? ` / ${logItem.distribution}` : ``}
                                                </span>
                                            </div>
                                            {logItem.reason ? (
                                                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{logItem.reason}</p>
                                            ) : (logItem as any).reasonHidden ? (
                                                <p className="mt-2 text-sm italic text-gray-400 dark:text-gray-500">Reason hidden</p>
                                            ) : null}
                                            <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700/60">
                                                <img
                                                    src={logItem.punisherInfo.thumbnail}
                                                    alt={`Thumbnail for ${logItem.punisherInfo.name}`}
                                                    className="h-5 w-5 rounded-full bg-gray-200"
                                                />
                                                <span className="text-xs text-gray-400 dark:text-gray-500">by</span>
                                                <Link
                                                    href={`https://roblox.com/users/${logItem.punisherInfo.id}/profile`}
                                                    target="_blank"
                                                    className="text-xs font-medium text-gray-600 transition hover:text-blue-500 dark:text-gray-300"
                                                >
                                                    {logItem.punisherInfo.name}
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex flex-row justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                            <Button
                                variant="discrete"
                                icon={ArrowLeftIcon}
                                size="medium"
                                onClick={() => setCreateData({ page: 1, userId: createData.userId })}
                            >
                                Back
                            </Button>
                            <Button
                                variant="primary"
                                icon={ChevronRightIcon}
                                className="grow"
                                onClick={() => {
                                    if (jumpToCreating) {
                                        setCreateData({ ...createData, page: 4, type: jumpToCreating });
                                    } else {
                                        setCreateData({ ...createData, page: 3 });
                                    }
                                }}
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {createData.page == 3 && (
                    <div className="flex flex-col gap-4">
                        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose an action</h2>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Select the type of record to log for {selectedUser !== false ? selectedUser.name : "this user"}.</p>
                            <div className="mt-3">
                                <Stepper steps={showPastHistory ? ["User", "History", "Type", "Details"] : ["User", "Type", "Details"]} current={showPastHistory ? 2 : 1} />
                            </div>
                        </div>

                        {loggingOptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 px-6 py-8 text-center dark:border-gray-700">
                                <NoSymbolIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No permissions</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">You do not have permission to create any logs.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {loggingOptions.map((option) => {
                                    const v = TYPE_VISUALS[option.id as LogType];
                                    const OptIcon = v?.icon;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => {
                                                //@ts-expect-error cope
                                                setCreateData({ ...createData, page: 4, type: option.id });
                                            }}
                                            className="group flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                                        >
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${v?.tint}`}>
                                                {OptIcon && <OptIcon className={`h-6 w-6 ${v?.iconClass}`} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{option.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                                            </div>
                                            <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:text-blue-500 dark:text-gray-600" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex border-t border-gray-200 pt-3 dark:border-gray-800">
                            <Button
                                variant="discrete"
                                icon={ArrowLeftIcon}
                                size="medium"
                                onClick={() => setCreateData(showPastHistory ? { ...createData, page: 2 } as any : { page: 1, userId: createData.userId })}
                            >
                                Back
                            </Button>
                        </div>
                    </div>
                )}

                {createData.page == 4 && createData.type == "promotion" && (
                    <ActionForm
                        title={`Promoting ${selectedUser !== false ? selectedUser.name : ""}`}
                        notifyText="By default ReAdmin will notify a user that they were promoted and why."
                        expiryEnabled={false}
                        promoteOption={true}
                    />
                )}
                {createData.page == 4 && createData.type == "demotion" && (
                    <ActionForm
                        title={`Demoting ${selectedUser !== false ? selectedUser.name : ""}`}
                        notifyText="By default ReAdmin will notify a user that they were demoted and why."
                        expiryEnabled={false}
                        demoteOption={true}
                    />
                )}
                {createData.page == 4 && createData.type == "writeup" && (
                    <ActionForm
                        title={`Writing Up ${selectedUser !== false ? selectedUser.name : ""}`}
                        notifyText="By default ReAdmin will notify a user that they were written up and why."
                        expiryRequired={false}
                        expiryEnabled={true}
                        demoteOption={false}
                    />
                )}
                {createData.page == 4 && createData.type == "suspension" && (
                    <ActionForm
                        title={`Suspending ${selectedUser !== false ? selectedUser.name : ""}`}
                        notifyText="By default ReAdmin will notify a user that they were suspended and why."
                        expiryRequired={true}
                        expiryEnabled={true}
                        demoteOption={true}
                    />
                )}
                {createData.page == 4 && createData.type == "termination" && (
                    <ActionForm
                        title={`Terminating ${selectedUser !== false ? selectedUser.name : ""}`}
                        notifyText="By default ReAdmin will notify a user that they were terminated and why."
                        expiryRequired={false}
                        demoteOption={true}
                        submitText="Submit Termination"
                    />
                )}
            </>
        </Modal>
    );
}
