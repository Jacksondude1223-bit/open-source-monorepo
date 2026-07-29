import { createHistory } from '~/services/workspaceServices/staffHistory';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

export const createHistoryAPI = async (req: FastifyRequest<{
    Body: {
        actioningUser: string,
        userId: string,
        reason: string,
        type: 'promotion' | 'writeup' | 'suspension' | 'termination',
        notify?: boolean,
        role?: string | false,
        expiresInDays?: number,
        approval_required: boolean,
    }
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    try {
        const { actioningUser, userId, reason, type, notify, role, expiresInDays, approval_required } = body;
        if (await isUserGDPRIgnored(userId)) {
            return res.status(200).send({
                success: false,
                reason: 'User is GDPR ignored'
            });
        }

        const history = await createHistory({
            groupId: workspace.groupId,
            actioningUser,
            userId,
            reason,
            type,
            notify: notify || false,
            role,
            ...(expiresInDays ? { expires: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) } : {}),
            approval_required,
            files: []
        })

        return res.send({ success: true, history })

    } catch (e) {
        res.status(500).send({
            success: false,
            reason: 'Internal server error'
        })

    }
};