import { ObjectId } from 'mongodb';


export type ReAdminModuleErrorReport = {
    _id?: ObjectId;
    groupId: string;
    robloxId: string;
    headers: { [key: string]: string };
    error: any;
    created: Date;
};
