import { ObjectId } from "mongodb";

export type HubResource = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description: string;
  previewThumbnail: string;
  coverImage?: string;
  url: string;
  cdnFilePath?: string;
  createdBy: string;
  container: ObjectId;
  created: Date;
}
