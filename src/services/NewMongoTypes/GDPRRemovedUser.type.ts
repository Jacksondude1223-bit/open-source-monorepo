import { ObjectId } from 'mongodb';

export type GDPRRemovedUser = {
    _id: ObjectId;
    robloxId: number;
    created: Date;
}
