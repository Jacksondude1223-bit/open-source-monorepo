import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { CommandParamater } from '~/services/NewMongoTypes/GameCommand.type';
import { FastifyRequest, FastifyReply } from 'fastify';

export const sendCommands = async (req: FastifyRequest<{
    Body: {
        commands: {
            id: string;
            name: string;
            paramaters: CommandParamater[];
        }[];
        gameId: string;
    };
}>, res: FastifyReply) => {
    const body = req.body;

    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const { commands } = body;

    try {
        const { gameId, placeId } = runningGame;
        const foundCommands = await readminCollections.game_command.find({ groupId, gameId, placeId }).toArray();

        const foundCommandIds = foundCommands.map(command => command.id);
        const newCommands = commands.filter(command => !foundCommandIds.includes(command.id));

        for (const command of newCommands) {
            await readminCollections.game_command.insertOne({
                groupId,
                gameId,
                placeId,

                id: command.id,
                name: command.name,
                paramaters: command.paramaters,
                enabled: true,
                permissions: {
                    usableByDepartments: [],
                    usableByUsers: [],
                    usableByGroupRole: []
                },
                created: new Date(),
                detected: true,
                updated: new Date()
            });
        }

        for (const command of foundCommands) {
            const updatedCommand = commands.find(c => c.id === command.id);
            if (!updatedCommand) {
                await readminCollections.game_command.updateOne({ _id: command._id }, { $set: { detected: false } });
            } else {
                await readminCollections.game_command.updateOne({ _id: command._id }, { $set: { name: updatedCommand.name, paramaters: updatedCommand.paramaters, updated: new Date() } });
            }
        }

        return res.send({ success: true })


    } catch (e) {
        console.error(e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Send Command Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};