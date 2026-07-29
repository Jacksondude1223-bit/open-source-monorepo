import { ObjectId } from "mongodb";

/**
 * Legacy task subtask shape. Retained only so the migration logic can read
 * documents written by the previous tasks implementation.
 */
export type LegacyTaskSubtask = {
  name: string;
  finished: boolean;
  id: string;
  finishedBy?: string;
};

/**
 * Legacy task document shape (pre-board rewrite). Used by the migration to read
 * old documents before converting them to the new {@link Task} shape.
 */
export type LegacyTask = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description: string;
  dueBy: Date;
  assignedUsers: string[];
  assignedDepartments: string[];
  tasks: LegacyTaskSubtask[];
  created: Date;
};

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export type TaskCustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'user';

/** A column on the board. A workspace board may have up to 25 of these. */
export type TaskCategory = {
  id: string;
  name: string;
  color: string; // tailwind color name e.g. 'blue', 'green'
  order: number;
};

/** Definition of a board-level custom field that every task may set a value for. */
export type TaskCustomFieldDefinition = {
  id: string;
  name: string;
  type: TaskCustomFieldType;
  options?: string[]; // only for `select`
  order: number;
};

/** One board per workspace. Holds the categories and custom field schema. */
export type TaskBoard = {
  _id?: ObjectId;
  groupId: string;
  categories: TaskCategory[];
  customFields: TaskCustomFieldDefinition[];
  created: Date;
  updated: Date;
};

export type TaskNote = {
  id: string;
  body: string;
  authorId: string; // roblox id
  created: Date;
};

export type TaskAttachment = {
  id: string;
  name: string;
  path: string; // S3 object key
  contentType: string;
  size: number;
  uploadedBy: string; // roblox id
  created: Date;
};

export type TaskTimelineEventType =
  | 'created'
  | 'note_added'
  | 'updated'
  | 'user_assigned'
  | 'user_unassigned'
  | 'department_assigned'
  | 'department_unassigned'
  | 'moved'
  | 'attachment_added'
  | 'attachment_removed'
  | 'reminder_added'
  | 'completed'
  | 'reopened';

export type TaskTimelineEvent = {
  id: string;
  type: TaskTimelineEventType;
  actorId?: string; // roblox id of whoever triggered it
  message: string; // human readable summary
  meta?: Record<string, unknown>;
  created: Date;
};

export type TaskReminderMethod = 'dm' | 'channel';

export type TaskReminder = {
  id: string;
  remindAt: Date;
  method: TaskReminderMethod;
  channelId?: string; // required when method === 'channel'
  message?: string;
  sent: boolean;
  sentAt?: Date;
  createdBy: string; // roblox id
  created: Date;
};

export type TaskCustomFieldValue = string | number | boolean | null;

export type Task = {
  _id?: ObjectId;
  groupId: string;
  categoryId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueBy?: Date | null;
  assignedUsers: string[]; // roblox ids
  assignedDepartments: string[]; // department ObjectId strings
  notes: TaskNote[];
  attachments: TaskAttachment[];
  customFields: Record<string, TaskCustomFieldValue>;
  timeline: TaskTimelineEvent[];
  reminders: TaskReminder[];
  order: number; // sort order within its category
  completed: boolean;
  archived: boolean;
  createdBy: string; // roblox id
  created: Date;
  updated: Date;
};
