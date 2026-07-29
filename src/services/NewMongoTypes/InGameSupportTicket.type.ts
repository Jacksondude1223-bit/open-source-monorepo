import { ObjectId } from "mongodb";

export type InGameEvents = {
    type: 'message',
    ticketId: string,
    username: string;
    userId: number;
    message: string,
    id: string,
    created: number
};

export type InGameSupportTicket = {
    _id?: ObjectId;
    groupId: string;

    runningGameId?: ObjectId;
    gameId: number;
    placeId: number;

    // Discord channel created for this call when callDiscordSettings is configured.
    discordChannelId?: string;

    type: 'support' | 'report';
    status: 'open' | 'claimed' | 'closed';
    claimedBy?: number;

    callerId: number;
    reportedUser: string;
    reason: string;

    messages: {
        username: string;
        userId: number;
        message: string;
        id: string;
        origin: 'agent' | 'user' | 'systemMessage'
        sentFrom: 'discord' | 'website' | 'game';
        created: Date;
    }[];

    closed: false | {
        user: string;
        reason: string | 'closedByUser' | 'userLeft' | 'serverClosed';
        date: Date;
        serverAcknowledged: boolean;
    };

    created: Date;
}
