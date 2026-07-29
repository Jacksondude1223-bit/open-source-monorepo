import { ObjectId } from 'mongodb';

// A single manager correction applied to a TimeEntry. Kept inline on the entry
// so the full audit trail travels with the record (mirrors how write-ups embed
// their own history rather than spinning up a parallel store).
export type TimeAdjustment = {
  by: string; // robloxId of the manager who made the change
  at: Date;
  action: 'edit' | 'force_out' | 'manual_add' | 'delete';
  reason: string; // required justification — surfaced in the audit view
  // Snapshot of the fields before/after the change for diffing in the UI.
  previous?: {
    clockIn?: Date;
    clockOut?: Date | null;
    durationMinutes?: number;
  };
  next?: {
    clockIn?: Date;
    clockOut?: Date | null;
    durationMinutes?: number;
  };
};

export type TimeEntryStatus = 'active' | 'completed';

// How the entry was originally created. `self` = staff clocked themselves in;
// `manual` = a manager added the entry after the fact as a correction.
export type TimeEntrySource = 'self' | 'manual';

export type TimeEntry = {
  _id?: ObjectId;
  groupId: string;
  userId: string; // robloxId of the staff member the time belongs to
  distribution: number; // distribution number the clock-in falls under
  status: TimeEntryStatus;
  source: TimeEntrySource;
  clockIn: Date;
  clockOut?: Date | null;
  durationMinutes?: number; // computed on clock-out / edit; absent while active
  note?: string; // optional note from the staff member when clocking in/out
  forcedOut?: boolean; // true when a manager force-clocked the user out
  needsReview?: boolean; // flagged for manager attention (e.g. over max shift)
  createdBy: string; // robloxId of whoever opened the entry
  editedBy?: string; // robloxId of the last manager to edit
  adjustments?: TimeAdjustment[]; // manager correction history (audit trail)
  created: Date;
  updated?: Date;
};
