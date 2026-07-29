import { ObjectId } from "mongodb";

export type ViewDownload = {
    _id?: ObjectId;
    processId: string;
    viewId: string;
    groupId: string;
    distributionNum: number | null;
    exportType: 'json' | 'csv';
    status?: 'processing' | 'finished';
    url?: string;
    created: Date;
    completed?: Date;
}