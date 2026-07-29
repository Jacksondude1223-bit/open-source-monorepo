import { ObjectId } from "mongodb";

// Atomic per-(group, game, day) sequence powering the short order numbers shown
// on boards/receipts. Incremented via findOneAndUpdate($inc) so concurrent
// creates (register + kiosk + drive-thru) never collide on a number. `day` is a
// UTC YYYY-MM-DD string so numbers reset daily and stay small.
export type OrderCounter = {
  _id?: ObjectId;
  groupId: string;
  gameId: string;
  day: string; // UTC YYYY-MM-DD
  seq: number;
};
