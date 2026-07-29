import { ObjectId } from "mongodb";

export type DiscordBots = {
  _id?: ObjectId;
  groupId: string;
  guildId: string;
  created: Date;
}
