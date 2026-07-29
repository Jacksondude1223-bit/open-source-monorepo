import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getCommands = async (req: FastifyRequest<{

}>, res: FastifyReply) => {
    const workspace = req.workspace;

    const groupId = workspace.groupId;

    try {
        const foundCommands = await readminCollections.game_command.find({ groupId }).toArray();

        return res.send({ success: true, foundCommands })


    } catch (e) {
        console.error(e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Send Command Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};