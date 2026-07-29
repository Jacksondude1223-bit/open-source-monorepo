import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { v4 } from 'uuid';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import {
  getProcessedUserObject,
  getProcessedUserObjectType,
} from '~/services/roblox.service';
import { uploadImageBuffer, presignUrl } from '~/services/CDN-service';
import StringToObjectID from '~/utils/StringToObjectID';
import {
  LegacyTask,
  Task,
  TaskBoard,
  TaskCategory,
  TaskCustomFieldDefinition,
  TaskCustomFieldType,
  TaskCustomFieldValue,
  TaskPriority,
  TaskReminder,
  TaskTimelineEvent,
  TaskTimelineEventType,
} from '~/services/NewMongoTypes/Task.type';

const MAX_CATEGORIES = 25;
const MAX_CUSTOM_FIELDS = 25;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DEFAULT_CATEGORY_SEED: Omit<TaskCategory, 'id'>[] = [
  { name: 'To Do', color: 'gray', order: 0 },
  { name: 'In Progress', color: 'blue', order: 1 },
  { name: 'Done', color: 'green', order: 2 },
];

const priorityEnum = z.enum(['none', 'low', 'medium', 'high', 'urgent']);
const customFieldTypeEnum = z.enum([
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'user',
]);

export interface GetTasksResult {
  board: TaskBoard;
  tasks: Task[];
  /** roblox id -> resolved user, for rendering note/timeline/assignee avatars */
  users: Record<string, getProcessedUserObjectType>;
}

function makeEvent(
  type: TaskTimelineEventType,
  message: string,
  actorId?: string,
  meta?: Record<string, unknown>,
): TaskTimelineEvent {
  return {
    id: v4(),
    type,
    actorId: actorId || undefined,
    message,
    meta,
    created: new Date(),
  };
}

function getActorId(ctx: { user?: any }): string {
  return (
    ctx.user?.dbUser?.robloxId?.toString() ||
    ctx.user?.roblox?.id?.toString() ||
    ''
  );
}

/** Ensures a board exists for the workspace and migrates any legacy tasks. */
async function ensureBoard(groupId: string): Promise<TaskBoard> {
  let board: TaskBoard | null = await readminCollections.task_board.findOne({
    groupId,
  });

  if (!board) {
    const now = new Date();
    const newBoard: TaskBoard = {
      groupId,
      categories: DEFAULT_CATEGORY_SEED.map((c) => ({ ...c, id: v4() })),
      customFields: [],
      created: now,
      updated: now,
    };
    await readminCollections.task_board.insertOne(newBoard);
    board = newBoard;
  }

  // Migrate any legacy-format task documents (those without a categoryId).
  const legacyTasks = (await readminCollections.task
    .find({ groupId, categoryId: { $exists: false } })
    .toArray()) as unknown as LegacyTask[];

  if (legacyTasks.length > 0) {
    const firstCategory = board?.categories[0];
    const now = new Date();
    for (const legacy of legacyTasks) {
      const notes: Task['notes'] = [];
      const subtasks = Array.isArray(legacy.tasks) ? legacy.tasks : [];
      if (subtasks.length > 0) {
        notes.push({
          id: v4(),
          body:
            'Migrated checklist:\n' +
            subtasks
              .map((s) => `${s.finished ? '[x]' : '[ ]'} ${s.name}`)
              .join('\n'),
          authorId: '',
          created: now,
        });
      }
      const migrated: Partial<Task> = {
        groupId,
        categoryId: firstCategory?.id || '',
        title: legacy.name || 'Untitled task',
        description: legacy.description || '',
        priority: 'none',
        dueBy: legacy.dueBy || null,
        assignedUsers: Array.isArray(legacy.assignedUsers)
          ? legacy.assignedUsers
          : [],
        assignedDepartments: Array.isArray(legacy.assignedDepartments)
          ? legacy.assignedDepartments
          : [],
        notes,
        attachments: [],
        customFields: {},
        timeline: [
          makeEvent('created', 'Task migrated from the previous tasks system'),
        ],
        reminders: [],
        order: 0,
        completed: subtasks.length > 0 && subtasks.every((s) => s.finished),
        archived: false,
        createdBy: '',
        created: legacy.created || now,
        updated: now,
      };
      await readminCollections.task.updateOne(
        { _id: legacy._id },
        {
          $set: migrated,
          $unset: { name: '', tasks: '' },
        },
      );
    }
  }

  return board;
}

function requireAssignPermission(ctx: { department: any }) {
  if (!ctx.department?.permissions?.tasks?.assign) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to manage tasks.',
    });
  }
}

async function loadTask(groupId: string, taskId: string): Promise<Task> {
  const task = (await readminCollections.task.findOne({
    groupId,
    _id: StringToObjectID(taskId),
  })) as Task | null;
  if (!task) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
  }
  return task;
}

export const workspaceTasksRouter = router({
  // ---------------------------------------------------------------------------
  // Board + tasks fetching
  // ---------------------------------------------------------------------------
  getTasks: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }): Promise<GetTasksResult> => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not logged in' });
      }
      const board = await ensureBoard(input.groupId);
      const tasks = (await readminCollections.task
        .find({ groupId: input.groupId, archived: { $ne: true } })
        .toArray()) as Task[];

      // Collect every roblox id referenced so the client can render avatars.
      const involvedIds = new Set<string>();
      for (const task of tasks) {
        task.assignedUsers?.forEach((id) => id && involvedIds.add(id));
        task.notes?.forEach((n) => n.authorId && involvedIds.add(n.authorId));
        task.timeline?.forEach((e) => e.actorId && involvedIds.add(e.actorId));
        task.attachments?.forEach(
          (a) => a.uploadedBy && involvedIds.add(a.uploadedBy),
        );
      }

      const users: Record<string, getProcessedUserObjectType> = {};
      await Promise.all(
        Array.from(involvedIds).map(async (id) => {
          users[id] = await getProcessedUserObject(id);
        }),
      );

      return { board, tasks, users };
    }),

  // ---------------------------------------------------------------------------
  // Category management
  // ---------------------------------------------------------------------------
  createCategory: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(60),
        color: z.string().min(1).max(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      if (board.categories.length >= MAX_CATEGORIES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You can only have up to ${MAX_CATEGORIES} categories.`,
        });
      }
      const category: TaskCategory = {
        id: v4(),
        name: input.name,
        color: input.color,
        order: board.categories.length,
      };
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $push: { categories: category }, $set: { updated: new Date() } },
      );
      return category;
    }),

  updateCategory: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        categoryId: z.string(),
        name: z.string().min(1).max(60).optional(),
        color: z.string().min(1).max(30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      const categories = board.categories.map((c) =>
        c.id === input.categoryId
          ? {
              ...c,
              name: input.name ?? c.name,
              color: input.color ?? c.color,
            }
          : c,
      );
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $set: { categories, updated: new Date() } },
      );
      return true;
    }),

  deleteCategory: workspaceProcedure
    .input(z.object({ groupId: z.string(), categoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      if (board.categories.length <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must keep at least one category.',
        });
      }
      const remaining = board.categories
        .filter((c) => c.id !== input.categoryId)
        .map((c, index) => ({ ...c, order: index }));
      const fallback = remaining[0];
      if (!fallback) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must keep at least one category.',
        });
      }

      // Move any tasks in the removed category to the first remaining one.
      await readminCollections.task.updateMany(
        { groupId: input.groupId, categoryId: input.categoryId },
        { $set: { categoryId: fallback.id, updated: new Date() } },
      );

      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $set: { categories: remaining, updated: new Date() } },
      );
      return true;
    }),

  reorderCategories: workspaceProcedure
    .input(z.object({ groupId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      const byId = new Map(board.categories.map((c) => [c.id, c]));
      const categories: TaskCategory[] = [];
      input.orderedIds.forEach((id) => {
        const c = byId.get(id);
        if (c) categories.push({ ...c, order: categories.length });
      });
      // Append any categories not present in orderedIds (safety).
      board.categories.forEach((c) => {
        if (!input.orderedIds.includes(c.id)) {
          categories.push({ ...c, order: categories.length });
        }
      });
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $set: { categories, updated: new Date() } },
      );
      return true;
    }),

  // ---------------------------------------------------------------------------
  // Custom field management
  // ---------------------------------------------------------------------------
  createCustomField: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(60),
        type: customFieldTypeEnum,
        options: z.array(z.string().min(1).max(60)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      if (board.customFields.length >= MAX_CUSTOM_FIELDS) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You can only have up to ${MAX_CUSTOM_FIELDS} custom fields.`,
        });
      }
      const field: TaskCustomFieldDefinition = {
        id: v4(),
        name: input.name,
        type: input.type as TaskCustomFieldType,
        options: input.type === 'select' ? input.options || [] : undefined,
        order: board.customFields.length,
      };
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $push: { customFields: field }, $set: { updated: new Date() } },
      );
      return field;
    }),

  updateCustomField: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        fieldId: z.string(),
        name: z.string().min(1).max(60).optional(),
        options: z.array(z.string().min(1).max(60)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      const customFields = board.customFields.map((f) =>
        f.id === input.fieldId
          ? {
              ...f,
              name: input.name ?? f.name,
              options:
                f.type === 'select' ? input.options ?? f.options : f.options,
            }
          : f,
      );
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $set: { customFields, updated: new Date() } },
      );
      return true;
    }),

  deleteCustomField: workspaceProcedure
    .input(z.object({ groupId: z.string(), fieldId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      const customFields = board.customFields
        .filter((f) => f.id !== input.fieldId)
        .map((f, index) => ({ ...f, order: index }));
      await readminCollections.task_board.updateOne(
        { _id: board._id },
        { $set: { customFields, updated: new Date() } },
      );
      await readminCollections.task.updateMany(
        { groupId: input.groupId },
        { $unset: { [`customFields.${input.fieldId}`]: '' } },
      );
      return true;
    }),

  // ---------------------------------------------------------------------------
  // Task CRUD
  // ---------------------------------------------------------------------------
  createTask: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        categoryId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        priority: priorityEnum.optional(),
        dueBy: z.date().nullable().optional(),
        assignedUsers: z.array(z.string()).optional(),
        assignedDepartments: z.array(z.string()).optional(),
        customFields: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const board = await ensureBoard(input.groupId);
      const category =
        board.categories.find((c) => c.id === input.categoryId) ||
        board.categories[0];
      if (!category) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No category available for this task.',
        });
      }
      const actorId = getActorId(ctx);
      const now = new Date();

      const count = await readminCollections.task.countDocuments({
        groupId: input.groupId,
        categoryId: category.id,
        archived: { $ne: true },
      });

      const newTask: Task = {
        groupId: input.groupId,
        categoryId: category.id,
        title: input.title,
        description: input.description || '',
        priority: (input.priority as TaskPriority) || 'none',
        dueBy: input.dueBy ?? null,
        assignedUsers: input.assignedUsers || [],
        assignedDepartments: input.assignedDepartments || [],
        notes: [],
        attachments: [],
        customFields: (input.customFields || {}) as Record<
          string,
          TaskCustomFieldValue
        >,
        timeline: [makeEvent('created', 'Task created', actorId)],
        reminders: [],
        order: count,
        completed: false,
        archived: false,
        createdBy: actorId,
        created: now,
        updated: now,
      };
      const result = await readminCollections.task.insertOne(newTask);
      return { ...newTask, _id: result.insertedId };
    }),

  updateTask: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10000).optional(),
        priority: priorityEnum.optional(),
        dueBy: z.date().nullable().optional(),
        categoryId: z.string().optional(),
        assignedUsers: z.array(z.string()).optional(),
        assignedDepartments: z.array(z.string()).optional(),
        customFields: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);
      const events: TaskTimelineEvent[] = [];
      const set: Partial<Task> = { updated: new Date() };

      if (input.title !== undefined && input.title !== task.title) {
        set.title = input.title;
        events.push(
          makeEvent('updated', `Title changed to "${input.title}"`, actorId),
        );
      }
      if (
        input.description !== undefined &&
        input.description !== task.description
      ) {
        set.description = input.description;
        events.push(makeEvent('updated', 'Description updated', actorId));
      }
      if (input.priority !== undefined && input.priority !== task.priority) {
        set.priority = input.priority as TaskPriority;
        events.push(
          makeEvent('updated', `Priority set to ${input.priority}`, actorId),
        );
      }
      if (input.dueBy !== undefined) {
        const oldTime = task.dueBy ? new Date(task.dueBy).getTime() : null;
        const newTime = input.dueBy ? new Date(input.dueBy).getTime() : null;
        if (oldTime !== newTime) {
          set.dueBy = input.dueBy;
          events.push(
            makeEvent(
              'updated',
              input.dueBy
                ? `Due date set to ${new Date(input.dueBy).toLocaleDateString()}`
                : 'Due date removed',
              actorId,
            ),
          );
        }
      }
      if (
        input.categoryId !== undefined &&
        input.categoryId !== task.categoryId
      ) {
        const board = await ensureBoard(input.groupId);
        const cat = board.categories.find((c) => c.id === input.categoryId);
        set.categoryId = input.categoryId;
        events.push(
          makeEvent(
            'moved',
            `Moved to ${cat?.name || 'another category'}`,
            actorId,
          ),
        );
      }
      if (input.assignedUsers !== undefined) {
        const before = new Set(task.assignedUsers || []);
        const after = new Set(input.assignedUsers);
        for (const id of after) {
          if (!before.has(id)) {
            const u = await getProcessedUserObject(id);
            events.push(
              makeEvent('user_assigned', `Assigned ${u.name || id}`, actorId, {
                userId: id,
              }),
            );
          }
        }
        for (const id of before) {
          if (!after.has(id)) {
            const u = await getProcessedUserObject(id);
            events.push(
              makeEvent(
                'user_unassigned',
                `Unassigned ${u.name || id}`,
                actorId,
                { userId: id },
              ),
            );
          }
        }
        set.assignedUsers = input.assignedUsers;
      }
      if (input.assignedDepartments !== undefined) {
        const before = new Set(task.assignedDepartments || []);
        const after = new Set(input.assignedDepartments);
        for (const id of after) {
          if (!before.has(id)) {
            events.push(
              makeEvent(
                'department_assigned',
                'Assigned a department',
                actorId,
                { departmentId: id },
              ),
            );
          }
        }
        for (const id of before) {
          if (!after.has(id)) {
            events.push(
              makeEvent(
                'department_unassigned',
                'Unassigned a department',
                actorId,
                { departmentId: id },
              ),
            );
          }
        }
        set.assignedDepartments = input.assignedDepartments;
      }
      if (input.customFields !== undefined) {
        set.customFields = {
          ...task.customFields,
          ...(input.customFields as Record<string, TaskCustomFieldValue>),
        };
        events.push(makeEvent('updated', 'Fields updated', actorId));
      }

      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $set: set,
          ...(events.length ? { $push: { timeline: { $each: events } } } : {}),
        },
      );
      return true;
    }),

  moveTask: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        toCategoryId: z.string(),
        orderedTaskIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);
      const movedCategory = task.categoryId !== input.toCategoryId;

      const ops = input.orderedTaskIds.map((id, index) => ({
        updateOne: {
          filter: { _id: StringToObjectID(id), groupId: input.groupId },
          update: { $set: { order: index, updated: new Date() } },
        },
      }));
      if (ops.length) {
        await readminCollections.task.bulkWrite(ops);
      }

      const update: Record<string, unknown> = {
        $set: { categoryId: input.toCategoryId, updated: new Date() },
      };
      if (movedCategory) {
        const board = await ensureBoard(input.groupId);
        const cat = board.categories.find((c) => c.id === input.toCategoryId);
        update.$push = {
          timeline: makeEvent(
            'moved',
            `Moved to ${cat?.name || 'another category'}`,
            actorId,
          ),
        };
      }
      await readminCollections.task.updateOne({ _id: task._id }, update);
      return true;
    }),

  setCompleted: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        completed: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);
      const event = makeEvent(
        input.completed ? 'completed' : 'reopened',
        input.completed ? 'Marked complete' : 'Reopened',
        actorId,
      );
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $set: { completed: input.completed, updated: new Date() },
          $push: { timeline: event },
        },
      );
      return true;
    }),

  deleteTask: workspaceProcedure
    .input(z.object({ groupId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      await readminCollections.task.deleteOne({ _id: task._id });
      return true;
    }),

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------
  addNote: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);
      const note = {
        id: v4(),
        body: input.body,
        authorId: actorId,
        created: new Date(),
      };
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $push: {
            notes: note,
            timeline: makeEvent('note_added', 'Added a note', actorId),
          },
          $set: { updated: new Date() },
        },
      );
      return note;
    }),

  deleteNote: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        noteId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const task = await loadTask(input.groupId, input.taskId);
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $pull: { notes: { id: input.noteId } },
          $set: { updated: new Date() },
        },
      );
      return true;
    }),

  // ---------------------------------------------------------------------------
  // Attachments
  // ---------------------------------------------------------------------------
  addAttachment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        name: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
        dataUrl: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);

      if (!ALLOWED_ATTACHMENT_TYPES.includes(input.contentType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'That file type is not allowed.',
        });
      }

      const base64 = input.dataUrl.includes(',')
        ? input.dataUrl.split(',')[1] || ''
        : input.dataUrl;
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Attachments must be 10MB or smaller.',
        });
      }

      const attachmentId = v4();
      const safeName = input.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `task-attachments/${input.groupId}/${task._id?.toString()}/${attachmentId}-${safeName}`;
      await uploadImageBuffer(path, buffer, input.contentType, 'private');

      const attachment = {
        id: attachmentId,
        name: input.name,
        path,
        contentType: input.contentType,
        size: buffer.byteLength,
        uploadedBy: actorId,
        created: new Date(),
      };
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $push: {
            attachments: attachment,
            timeline: makeEvent(
              'attachment_added',
              `Attached ${input.name}`,
              actorId,
            ),
          },
          $set: { updated: new Date() },
        },
      );
      return attachment;
    }),

  getAttachmentUrl: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        attachmentId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const task = await loadTask(input.groupId, input.taskId);
      const attachment = task.attachments?.find(
        (a) => a.id === input.attachmentId,
      );
      if (!attachment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Attachment not found',
        });
      }
      return { url: await presignUrl(attachment.path, 60 * 60) };
    }),

  deleteAttachment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        attachmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $pull: { attachments: { id: input.attachmentId } },
          $push: {
            timeline: makeEvent(
              'attachment_removed',
              'Removed an attachment',
              actorId,
            ),
          },
          $set: { updated: new Date() },
        },
      );
      return true;
    }),

  // ---------------------------------------------------------------------------
  // Reminders
  // ---------------------------------------------------------------------------
  addReminder: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        remindAt: z.date(),
        method: z.enum(['dm', 'channel']),
        channelId: z.string().optional(),
        message: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      const actorId = getActorId(ctx);

      if (input.method === 'channel' && !input.channelId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A Discord channel ID is required for channel reminders.',
        });
      }

      const reminder: TaskReminder = {
        id: v4(),
        remindAt: input.remindAt,
        method: input.method,
        channelId: input.method === 'channel' ? input.channelId : undefined,
        message: input.message,
        sent: false,
        createdBy: actorId,
        created: new Date(),
      };
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $push: {
            reminders: reminder,
            timeline: makeEvent(
              'reminder_added',
              `Reminder set for ${new Date(input.remindAt).toLocaleString()}`,
              actorId,
            ),
          },
          $set: { updated: new Date() },
        },
      );
      return reminder;
    }),

  deleteReminder: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        taskId: z.string(),
        reminderId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAssignPermission(ctx);
      const task = await loadTask(input.groupId, input.taskId);
      await readminCollections.task.updateOne(
        { _id: task._id },
        {
          $pull: { reminders: { id: input.reminderId } },
          $set: { updated: new Date() },
        },
      );
      return true;
    }),
});
