import { ObjectId } from "mongodb";

export type InGameCallBan = {
    _id?: ObjectId;
    groupId: string;

    // Roblox user that is banned from creating support calls / reports.
    userId: number;

    // Required reason explaining why the user was banned from calls.
    reason: string;

    // The previous call (in_game_support_ticket) this ban is linked to so
    // moderators can review what was said before issuing the ban.
    linkedCallId?: ObjectId;

    // Agent who issued the ban.
    bannedBy: number;
    bannedByName: string;

    created: Date;
};
