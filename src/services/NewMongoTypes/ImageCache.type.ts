import { ObjectId } from "mongodb";

export type ImageCache = {
    _id?: ObjectId;
    filePath: string;
    signedUrl: string;
    from: Date;
    expires: Date;
    created: Date;
}
