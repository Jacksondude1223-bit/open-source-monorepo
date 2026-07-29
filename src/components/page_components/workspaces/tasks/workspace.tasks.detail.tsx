/* eslint-disable @next/next/no-img-element */
import {
  ArrowUpTrayIcon,
  PaperClipIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ReactTimeago from 'react-timeago';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextArea from '~/components/forms/TextArea';
import TextLabel from '~/components/forms/TextLabel';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import Modal from '~/components/ui/Modal';
import Badge from '~/components/ui/Badge';
import { Attachment } from '~/pages/workspaces/[groupId]';
import { trpc } from '~/utils/trpc';
import {
  BoardTask,
  CustomFieldDef,
  colorDotClass,
  PRIORITIES,
  PRIORITY_BADGE,
  ResolvedUsers,
  sortedCategories,
  TasksData,
} from './workspace.tasks.shared';

type Department = { _id: string; name: string };

type TabKey = 'details' | 'notes' | 'timeline' | 'attachments' | 'reminders';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'notes', label: 'Notes' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'reminders', label: 'Reminders' },
];

function UserChip({
  user,
  onRemove,
}: {
  user?: ResolvedUsers[string];
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 pl-1 pr-2 py-1">
      <img
        src={user?.thumbnail}
        alt=""
        className="w-6 h-6 rounded-full bg-gray-300"
      />
      <span className="text-xs">{user?.name || 'Unknown'}</span>
      {onRemove && (
        <button onClick={onRemove} type="button">
          <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
}

type TaskAttachmentItem = NonNullable<BoardTask['attachments']>[number];

function TaskAttachmentCard({
  groupId,
  taskId,
  att,
  canManage,
  onChanged,
}: {
  groupId: string;
  taskId: string;
  att: TaskAttachmentItem;
  canManage: boolean;
  onChanged: () => void;
}) {
  const utils = trpc.useUtils();
  const deleteAttachment =
    trpc.workspaces.workspace.tasks.deleteAttachment.useMutation();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    utils.workspaces.workspace.tasks.getAttachmentUrl
      .fetch({ groupId, taskId, attachmentId: att.id })
      .then((res) => {
        if (active && res?.url) setUrl(res.url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.id]);

  return (
    <div className="relative group">
      {url ? (
        <Attachment
          attachment={url}
          name={att.name}
          contentType={att.contentType}
        />
      ) : (
        <div className="w-32 h-[7.5rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse" />
      )}
      {canManage && (
        <button
          title="Delete attachment"
          disabled={deleteAttachment.isPending}
          onClick={() =>
            deleteAttachment
              .mutateAsync({ groupId, taskId, attachmentId: att.id })
              .then(onChanged)
              .catch((e) => toast.error(e.message || 'Failed to delete'))
          }
          className="absolute -top-2 -right-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function TaskDetailModal({
  groupId,
  task,
  board,
  users,
  departments,
  canManage,
  open,
  setOpen,
}: {
  groupId: string;
  task: BoardTask | null;
  board: TasksData['board'];
  users: ResolvedUsers;
  departments: Department[];
  canManage: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<TabKey>('details');
  const [noteBody, setNoteBody] = useState('');

  // ----- Reminder form local state -----
  const [reminderAt, setReminderAt] = useState('');
  const [reminderMethod, setReminderMethod] = useState<'dm' | 'channel'>('dm');
  const [reminderChannel, setReminderChannel] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');

  const updateTask = trpc.workspaces.workspace.tasks.updateTask.useMutation();
  const addNote = trpc.workspaces.workspace.tasks.addNote.useMutation();
  const deleteNote = trpc.workspaces.workspace.tasks.deleteNote.useMutation();
  const addAttachment =
    trpc.workspaces.workspace.tasks.addAttachment.useMutation();
  const addReminder =
    trpc.workspaces.workspace.tasks.addReminder.useMutation();
  const deleteReminder =
    trpc.workspaces.workspace.tasks.deleteReminder.useMutation();
  const setCompleted =
    trpc.workspaces.workspace.tasks.setCompleted.useMutation();

  const refresh = () =>
    utils.workspaces.workspace.tasks.getTasks.invalidate({ groupId });

  if (!task) return <></>;
  const taskId = task._id?.toString() || '';

  const save = async (patch: Record<string, unknown>) => {
    await updateTask
      .mutateAsync({ groupId, taskId, ...patch })
      .then(refresh)
      .catch((e) => toast.error(e.message || 'Failed to update task'));
  };

  const renderCustomField = (field: CustomFieldDef) => {
    const value = (task.customFields || {})[field.id];
    const commonSave = (v: unknown) =>
      save({ customFields: { [field.id]: v as never } });

    if (field.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!canManage}
            defaultChecked={!!value}
            className="rounded"
            onChange={(e) => commonSave(e.target.checked)}
          />
          {field.name}
        </label>
      );
    }
    if (field.type === 'select') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.name}
          </label>
          <Dropdown
            id={`cf-${field.id}`}
            choices={[
              { id: '', name: '—' },
              ...(field.options || []).map((o) => ({ id: o, name: o })),
            ]}
            defaultValue={(value as string) || ''}
            onChange={(v) => commonSave(v || null)}
          />
        </div>
      );
    }
    if (field.type === 'user') {
      const u = value ? users[value as string] : undefined;
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.name}
          </label>
          <div className="mt-1 flex items-center gap-2">
            {u && <UserChip user={u} />}
            {canManage && (
              <RobloxUserSearch
                groupId={groupId}
                enableIcon={false}
                size="small"
                id={`cfu-${field.id}`}
                color="blue"
                className="w-full"
                onSelectUser={async (userId) => commonSave(userId)}
              />
            )}
          </div>
        </div>
      );
    }
    // text / number / date
    return (
      <TextLabel
        label={field.name}
        id={`cf-${field.id}`}
        required={false}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        defaultValue={
          field.type === 'date' && value
            ? new Date(value as string).toISOString().slice(0, 10)
            : (value as string) || ''
        }
        onBlur={(v) => {
          if (!canManage) return;
          commonSave(
            field.type === 'number'
              ? v === ''
                ? null
                : Number(v)
              : v || null,
          );
        }}
      />
    );
  };

  const timeline = [...(task.timeline || [])].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  );
  const notes = [...(task.notes || [])].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  );

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="3xl">
      <div className="flex flex-col max-h-[82vh] -mx-4 -mt-5 sm:-mx-6 sm:-mt-6">
        {/* Coloured accent strip */}
        <div
          className={`h-1.5 w-full rounded-t-lg ${colorDotClass(
            sortedCategories(board.categories).find(
              (c) => c.id === task.categoryId,
            )?.color || 'gray',
          )}`}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${colorDotClass(
                  sortedCategories(board.categories).find(
                    (c) => c.id === task.categoryId,
                  )?.color || 'gray',
                )}`}
              />
              {sortedCategories(board.categories).find(
                (c) => c.id === task.categoryId,
              )?.name || '—'}
            </div>
            <input
              defaultValue={task.title}
              key={`title-${task.updated}`}
              disabled={!canManage}
              className="w-full bg-transparent text-xl font-bold focus:outline-none focus:ring-0 rounded-md px-1 -mx-1 focus:bg-gray-100 dark:focus:bg-gray-800 dark:text-gray-100"
              onBlur={(e) => {
                if (canManage && e.target.value && e.target.value !== task.title)
                  save({ title: e.target.value });
              }}
            />
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge color={PRIORITY_BADGE[task.priority]}>
                {PRIORITIES.find((p) => p.id === task.priority)?.name}
              </Badge>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  defaultChecked={task.completed}
                  key={`done-${task.updated}`}
                  onChange={(e) =>
                    setCompleted
                      .mutateAsync({
                        groupId,
                        taskId,
                        completed: e.target.checked,
                      })
                      .then(refresh)
                  }
                />
                Mark complete
              </label>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mt-4 px-4 sm:px-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
              {t.key === 'notes' && notes.length > 0 && ` (${notes.length})`}
              {t.key === 'attachments' &&
                (task.attachments?.length || 0) > 0 &&
                ` (${task.attachments.length})`}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto py-4 px-4 sm:px-6">
          {/* DETAILS */}
          {tab === 'details' && (
            <div className="flex flex-col gap-4">
              <TextArea
                label="Description"
                id="description"
                required={false}
                rows={4}
                defaultValue={task.description}
                onBlur={(v) => {
                  if (canManage && v !== task.description)
                    save({ description: v });
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <Dropdown
                    id="priority"
                    choices={PRIORITIES.map((p) => ({ id: p.id, name: p.name }))}
                    defaultValue={task.priority}
                    onChange={(v) => canManage && save({ priority: v })}
                  />
                </div>
                <TextLabel
                  label="Due date"
                  id="dueBy"
                  type="date"
                  required={false}
                  defaultValue={
                    task.dueBy
                      ? new Date(task.dueBy).toISOString().slice(0, 10)
                      : ''
                  }
                  onBlur={(v) =>
                    canManage &&
                    save({ dueBy: v ? new Date(v + 'T12:00:00') : null })
                  }
                />
              </div>

              {/* Assigned users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assigned users
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(task.assignedUsers || []).map((id) => (
                    <UserChip
                      key={id}
                      user={users[id]}
                      onRemove={
                        canManage
                          ? () =>
                              save({
                                assignedUsers: (task.assignedUsers || []).filter(
                                  (u) => u !== id,
                                ),
                              })
                          : undefined
                      }
                    />
                  ))}
                </div>
                {canManage && (
                  <div className="mt-2">
                    <RobloxUserSearch
                      groupId={groupId}
                      enableIcon={false}
                      size="small"
                      color="blue"
                      id="assignUser"
                      className="w-full"
                      onSelectUser={async (userId) => {
                        if ((task.assignedUsers || []).includes(userId)) return;
                        await save({
                          assignedUsers: [
                            ...(task.assignedUsers || []),
                            userId,
                          ],
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Assigned departments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assigned departments
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {departments.map((dep) => {
                    const active = (task.assignedDepartments || []).includes(
                      dep._id.toString(),
                    );
                    return (
                      <button
                        key={dep._id.toString()}
                        disabled={!canManage}
                        onClick={() => {
                          const id = dep._id.toString();
                          const next = active
                            ? (task.assignedDepartments || []).filter(
                                (d) => d !== id,
                              )
                            : [...(task.assignedDepartments || []), id];
                          save({ assignedDepartments: next });
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          active
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500'
                        }`}
                      >
                        {dep.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom fields */}
              {board.customFields.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <h3 className="text-sm font-semibold mb-2">Custom fields</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...board.customFields]
                      .sort((a, b) => a.order - b.order)
                      .map((field) => (
                        <div key={field.id}>{renderCustomField(field)}</div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          {tab === 'notes' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <TextArea
                  id="newNote"
                  placeholder="Write a note..."
                  required={false}
                  rows={2}
                  defaultValue={noteBody}
                  onBlur={(v) => setNoteBody(v)}
                />
                <Button
                  variant="blue"
                  size="small"
                  className="w-min"
                  icon={PlusIcon}
                  onClick={() => {
                    if (!noteBody.trim()) return;
                    addNote
                      .mutateAsync({ groupId, taskId, body: noteBody })
                      .then(() => {
                        setNoteBody('');
                        refresh();
                      });
                  }}
                >
                  Add note
                </Button>
              </div>
              {notes.length === 0 && (
                <p className="text-sm text-gray-500">No notes yet.</p>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {note.authorId && users[note.authorId] && (
                        <img
                          src={users[note.authorId]?.thumbnail}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <span className="text-xs font-medium">
                        {note.authorId
                          ? users[note.authorId]?.name || 'Unknown'
                          : 'System'}
                      </span>
                      <span className="text-xs text-gray-400">
                        <ReactTimeago date={note.created} />
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        deleteNote
                          .mutateAsync({ groupId, taskId, noteId: note.id })
                          .then(refresh)
                      }
                    >
                      <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{note.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* TIMELINE */}
          {tab === 'timeline' && (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2">
              {timeline.length === 0 && (
                <p className="text-sm text-gray-500 pl-4">No activity yet.</p>
              )}
              {timeline.map((event) => (
                <li key={event.id} className="mb-4 ml-4">
                  <div className="absolute w-2 h-2 bg-blue-400 rounded-full -left-1 mt-1.5" />
                  <div className="flex items-center gap-2">
                    {event.actorId && users[event.actorId] && (
                      <img
                        src={users[event.actorId]?.thumbnail}
                        alt=""
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="text-sm">{event.message}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {event.actorId
                      ? `${users[event.actorId]?.name || 'Unknown'} · `
                      : ''}
                    <ReactTimeago date={event.created} />
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* ATTACHMENTS */}
          {tab === 'attachments' && (
            <div className="flex flex-col gap-4">
              {canManage && (
                <label className="flex flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-900/10">
                  <ArrowUpTrayIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {addAttachment.isPending
                      ? 'Uploading…'
                      : 'Click to upload a file'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Images, PDFs and documents up to 10MB
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={addAttachment.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File must be 10MB or smaller.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        addAttachment
                          .mutateAsync({
                            groupId,
                            taskId,
                            name: file.name,
                            contentType: file.type || 'application/octet-stream',
                            dataUrl: reader.result as string,
                          })
                          .then(refresh)
                          .catch((err) =>
                            toast.error(err.message || 'Upload failed'),
                          );
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {(task.attachments?.length || 0) === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-400">
                  <PaperClipIcon className="w-8 h-8" />
                  <p className="text-sm">No attachments yet.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {task.attachments?.map((att) => (
                    <TaskAttachmentCard
                      key={att.id}
                      groupId={groupId}
                      taskId={taskId}
                      att={att}
                      canManage={canManage}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REMINDERS */}
          {tab === 'reminders' && (
            <div className="flex flex-col gap-3">
              {canManage && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">New reminder</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextLabel
                      label="Remind at"
                      id="remindAt"
                      type="datetime-local"
                      required={false}
                      value={reminderAt}
                      onChange={(v) => setReminderAt(v)}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Method
                      </label>
                      <Dropdown
                        id="reminderMethod"
                        choices={[
                          { id: 'dm', name: 'Discord DM (assigned users)' },
                          { id: 'channel', name: 'Discord channel message' },
                        ]}
                        defaultValue={reminderMethod}
                        onChange={(v) =>
                          setReminderMethod(v as 'dm' | 'channel')
                        }
                      />
                    </div>
                  </div>
                  {reminderMethod === 'channel' && (
                    <TextLabel
                      label="Discord channel ID"
                      id="reminderChannel"
                      required={false}
                      placeholder="e.g. 123456789012345678"
                      onChange={(v) => setReminderChannel(v)}
                    />
                  )}
                  <TextArea
                    label="Message (optional)"
                    id="reminderMessage"
                    required={false}
                    rows={2}
                    onBlur={(v) => setReminderMessage(v)}
                  />
                  <Button
                    variant="blue"
                    size="small"
                    className="w-min"
                    icon={PlusIcon}
                    onClick={() => {
                      if (!reminderAt) {
                        toast.error('Pick a reminder time.');
                        return;
                      }
                      addReminder
                        .mutateAsync({
                          groupId,
                          taskId,
                          remindAt: new Date(reminderAt),
                          method: reminderMethod,
                          channelId:
                            reminderMethod === 'channel'
                              ? reminderChannel
                              : undefined,
                          message: reminderMessage || undefined,
                        })
                        .then(() => {
                          setReminderAt('');
                          setReminderMessage('');
                          setReminderChannel('');
                          refresh();
                        })
                        .catch((e) =>
                          toast.error(e.message || 'Failed to add reminder'),
                        );
                    }}
                  >
                    Add reminder
                  </Button>
                </div>
              )}
              {(task.reminders?.length || 0) === 0 && (
                <p className="text-sm text-gray-500">No reminders set.</p>
              )}
              {task.reminders?.map((rem) => (
                <div
                  key={rem.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                >
                  <div className="text-sm">
                    <span className="font-medium">
                      {rem.method === 'dm' ? 'DM' : 'Channel'}
                    </span>{' '}
                    · {new Date(rem.remindAt).toLocaleString()}
                    {rem.sent && (
                      <Badge color="green">
                        <span>Sent</span>
                      </Badge>
                    )}
                    {rem.message && (
                      <p className="text-xs text-gray-500">{rem.message}</p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() =>
                        deleteReminder
                          .mutateAsync({ groupId, taskId, reminderId: rem.id })
                          .then(refresh)
                      }
                    >
                      <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 py-3 px-4 sm:px-6">
          <div className="text-xs text-gray-400">
            Category:{' '}
            {sortedCategories(board.categories).find(
              (c) => c.id === task.categoryId,
            )?.name || '—'}
          </div>
          <span className="text-xs text-gray-400">
            Created <ReactTimeago date={task.created} />
          </span>
        </div>
      </div>
    </Modal>
  );
}
