import { readminCollections } from '~/services/mongo.service';
import { getUserInfo } from '~/services/roblox.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';


export const createBan = async (req: FastifyRequest<{
    Body: { userId: string; reason: string; bannedByUserId: string; expiresInDays?: number; };
}>, res: FastifyReply) => {
    const { workspace, body } = req;

    try {

        const { userId, reason, bannedByUserId, expiresInDays } = body;
        if (await isUserGDPRIgnored(userId)) {
            return res.status(200).send({
                success: false,
                reason: 'User is GDPR ignored'
            });
        }
        const expires = (expiresInDays && typeof (expiresInDays) == 'number') ? new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)) : undefined;
        const userInfo = await getUserInfo(userId);
        const bannerUserInfo = await getUserInfo(bannedByUserId);
        if (!userInfo) {
            return res.status(400).send({ success: false, reason: 'Invalid userId' })
        }
        if (!bannerUserInfo) {
            return res.status(400).send({ success: false, reason: 'Invalid bannedByUserId' })
        }

        const inserted = await readminCollections.workspace_bans.insertOne({
            groupId: workspace.groupId,
            userId: userInfo.id.toString(),
            reason,
            disciplinarianId: bannerUserInfo.id.toString(),
            active: true,
            ...(expires ? { expires } : {}),
            created: new Date(),
        })

        return res.status(201).send({ success: true, ban: await readminCollections.workspace_bans.findOne({ _id: inserted.insertedId }) })


    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};