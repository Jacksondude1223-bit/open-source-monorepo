import { ObjectId } from "mongodb";

// A grouping of products. Drives the POS category tabs AND prep-board routing:
// a category can be routed only to boards carrying a matching tag (e.g. a
// "Drinks" category with routeToBoardTags: ["barista"] only appears on boards
// tagged "barista"). Empty/absent routeToBoardTags = route to every board.
export type ProductCategory = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  sortOrder: number;
  routeToBoardTags?: string[]; // board tags this category's orders should be sent to
  created: Date;
  createdBy: string;
  lastModified?: Date;
  lastModifiedBy?: string;
};
