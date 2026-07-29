import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { UserNote, UserNoteCategory } from '~/services/NewMongoTypes';

// Team "feedback" of the advisory kind (commendation / poor performance) is stored
// as a user_note with a category + teamId rather than in a separate collection, so
// there is a single source of truth per user. Disciplinary feedback (strike /
// demotion recommendation) goes through staff history (write_ups) instead — see
// the feedback router. This module reads/writes only the note-backed kinds.

const FEEDBACK_CATEGORIES: UserNoteCategory[] = ['commendation', 'poor_performance'];

export type FeedbackEntry = {
  _id?: ObjectId;
  groupId: string;
  teamId: string | null;
  fromUserId: string;
  toUserId: string;
  type: UserNoteCategory;
  note: string;
  created: Date;
};

function noteToFeedback(note: UserNote): FeedbackEntry {
  return {
    _id: note._id,
    groupId: note.groupId,
    teamId: note.teamId ? note.teamId.toString() : null,
    fromUserId: note.authorId,
    toUserId: note.userId,
    type: (note.category ?? 'poor_performance') as UserNoteCategory,
    note: note.note,
    created: note.created,
  };
}

export async function submitFeedback(
  groupId: string,
  teamId: string,
  fromUserId: string,
  toUserId: string,
  type: UserNoteCategory,
  note: string,
): Promise<FeedbackEntry> {
  const doc: UserNote = {
    groupId,
    userId: toUserId,
    authorId: fromUserId,
    note,
    // Performance concerns are sensitive, so default them to admin-only visibility;
    // commendations are visible to staff who can view the user's activity.
    adminOnly: type === 'poor_performance',
    attachments: [],
    created: new Date(),
    category: type,
    teamId: new ObjectId(teamId),
  };
  const result = await readminCollections.user_note.insertOne(doc as any);
  return noteToFeedback({ ...doc, _id: result.insertedId });
}

export async function getFeedbackForUser(
  groupId: string,
  userId: string,
): Promise<FeedbackEntry[]> {
  const notes = await readminCollections.user_note
    .find({ groupId, userId, category: { $in: FEEDBACK_CATEGORIES } })
    .sort({ created: -1 })
    .toArray();
  return notes.map(noteToFeedback);
}

export async function getFeedbackByTeam(
  groupId: string,
  teamId: string,
): Promise<FeedbackEntry[]> {
  const notes = await readminCollections.user_note
    .find({ groupId, teamId: new ObjectId(teamId), category: { $in: FEEDBACK_CATEGORIES } })
    .sort({ created: -1 })
    .toArray();
  return notes.map(noteToFeedback);
}

export async function deleteFeedback(
  groupId: string,
  feedbackId: string,
): Promise<void> {
  // Restrict deletes to feedback-backed notes so this endpoint can't remove
  // arbitrary free-form user notes.
  await readminCollections.user_note.deleteOne({
    _id: new ObjectId(feedbackId),
    groupId,
    category: { $in: FEEDBACK_CATEGORIES },
  });
}
