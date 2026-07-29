import { FastifyInstance, FastifyRequest } from "fastify";
import { resolve } from "path";
import { sendReAdminInternalWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import StringToObjectID from "~/utils/StringToObjectID";
import fp from 'fastify-plugin';

function getRunningServerHook(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (
        request: FastifyRequest<{
            Headers: {
                ['loader-id']: string;
                ['roblox-id']: string;
            };
            Querystring: {
                gameId?: string;
            }
            Body: {
                gameId?: string;
            }
        }>, reply) => {
        if (request?.routeOptions?.config?.getRunningServer !== true) {
            return;
        }

        const loaderId = request.headers["loader-id"];
        const robloxGameId = request.headers["roblox-id"];
        const gameId = request.body?.gameId || request.query?.gameId;

        if (!loaderId) {
            return reply.status(401).send({
                success: false,
                reason: "Loader ID was not provided",
            });
        }

        if (!gameId) {
            return reply.status(401).send({
                success: false,
                reason: "Game ID was not provided",
            });
        }

        try {
            const workspace = await readminCollections.workspace.findOne({ loaderId: request.headers["loader-id"] });
            if (!workspace) {
                return reply.status(401).send({
                    success: false,
                    reason: "Loader ID was not correct",
                });
            }

            const runningGame = await readminCollections.running_games.findOne({ _id: StringToObjectID(gameId) });
            if (!runningGame) {
                sendReAdminInternalWebhookMessage('internalGameIdNotFound', `red`, `Failed to find internal game id ${gameId}`, `Workspace: ${workspace?.groupName} / Game: ${robloxGameId} `)
                console.log(`Failed to find internal game id ${gameId} (Workspace: ${workspace?.groupName} / Game: ${robloxGameId})`);
                return reply.status(401).send({
                    success: false,
                    reason: "Internal game ID was not correct",
                });
            }

            if (runningGame.groupId !== workspace.groupId) {
                sendReAdminInternalWebhookMessage('internalGameIdNotFound', `red`, `Failed to find internal game id ${gameId} DUE TO MISMATCH`, `Workspace: ${workspace?.groupName} / Game: ${robloxGameId}`)
                return reply.status(401).send({
                    success: false,
                    reason: "Internal game ID was not correct - mismatch",
                });
            }

            // Update last ping asynchronously
            readminCollections.running_games.updateOne(
                { _id: runningGame._id },
                { $set: { lastPing: new Date() } }
            );

            request.workspace = workspace;
            request.runningGame = runningGame;

            return;

        } catch (error) {
            console.error('Error in getRunningServer middleware', error);
            return reply.status(500).send({
                success: false,
                reason: "Internal Server Error",
            });
        }
    })
}

export default fp(getRunningServerHook);