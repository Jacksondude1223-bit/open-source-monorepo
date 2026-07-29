import { readminCollections } from '~/services/mongo.service';
import { ObjectId } from 'mongodb';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import { handleCallDiscordClose } from '~/services/callDiscord.service';

export const supportEnd = async (req: FastifyRequest<{
    Body: {
        supportId: string;
        reason: 'closedByUser' | 'userLeft' | 'serverClosed';
        gameId: string
    };
}>, res: FastifyReply) => {
    const body = req.body;

    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const internalGameId = runningGame.internalGameId;

    try {

        const {
            supportId,
            reason
        } = body;


        const { groupId } = workspace;

        if (!supportId || !reason) {
            return res.status(400).send({ success: false, reason: 'Missing required parameters' });
        }

        const foundSupportTicket = await readminCollections.in_game_support_ticket.findOne({
            groupId,
            _id: new ObjectId(supportId),
        })

        if (!foundSupportTicket) {
            return res.status(400).send({ success: false, reason: 'Support ticket not found' });
        }

        if (foundSupportTicket.status === 'closed') {
            return res.status(400).send({ success: false, reason: 'Support ticket already closed' });
        }

        await readminCollections.in_game_support_ticket.updateOne({
            _id: new ObjectId(supportId),
        }, {
            $set: {
                status: 'closed',
                closed: {
                    user: 'system',
                    reason: reason,
                    date: new Date(),
                    serverAcknowledged: false
                }
            },
            $push: {
                messages: {
                    username: 'ReAdminApp',
                    userId: 2611329969,
                    message: `Support ticket closed due to: ${{closedByUser: 'Closed by user', userLeft: 'User left', serverClosed: 'Server closed'}[reason]}`,
                    id: v4(),
                    origin: 'systemMessage',
                    sentFrom: 'game',
                    created: new Date()
                }
            }
        })

        // Tear down / archive the Discord call channel per workspace settings.
        handleCallDiscordClose(foundSupportTicket).catch(() => { });

        return res.send({ success: true });
    } catch (e) {
        console.error('Support Create Error', e);
        console.error(e);
        console.error('Support Create Error');
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};