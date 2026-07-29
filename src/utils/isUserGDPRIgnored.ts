import { readminCollections } from "~/services/mongo.service";

export async function isUserGDPRIgnored(robloxId: string): Promise<boolean> {
    const user = await readminCollections.gdpr_removed_user.findOne({ robloxId: parseInt(robloxId) });
    if (user) {
        return true;
    }
    return false;
}

export async function getAllGDPRIgnoredUsers(): Promise<string[]> {
    const users = await readminCollections.gdpr_removed_user.find({}).toArray();
    return users.map(user => user.robloxId.toString());
}