import { readminCollections } from '~/services/mongo.service';

export const syncBans = async () => {
    console.log('Syncing bans')

    await readminCollections.workspace_bans.updateMany(
        {
            expires: { $lte: new Date() },

        },
        {
            $set: { active: false }
        }
    );
    await readminCollections.workspace_bans.updateMany(
        {
            expires: { $gte: new Date() },
        },
        {
            $set: { active: true }
        }
    );
    console.log('Synced bans')
    return true;
};