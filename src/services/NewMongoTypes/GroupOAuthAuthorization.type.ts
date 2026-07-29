import { ObjectId } from 'mongodb';

export type GroupOAuthAuthorization = {
    _id?: ObjectId;
    groupId: string;
    refreshToken: string;
    currentAccessToken?: string;
    accessTokenUpdatedAt?: Date;
    scope: string;
    lastUsed: Date;
    sub: string;
    name: string;
    nickname: string;
    preferred_username: string;
    created_at: number;
    profile: string;
    picture: string;
    created: Date;
};
