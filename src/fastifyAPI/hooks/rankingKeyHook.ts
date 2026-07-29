import { FastifyInstance, FastifyRequest } from "fastify";
import { resolve } from "path";
import { sendReAdminInternalWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import StringToObjectID from "~/utils/StringToObjectID";
import fp from 'fastify-plugin';

function rankingKeyHook(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (
        request: FastifyRequest<{
            Headers: {
                ['api-key']: string;
            };
        }>, reply) => {
        if (request?.routeOptions?.config?.rankingKey !== true) {
            return;
        }

        const rankingKey = request.headers['api-key'];


        if (!rankingKey) {
            return reply.status(401).send({
                success: false,
                reason: 'Unauthorized'
            })
        }

        const foundKey = await readminCollections.ranking_key.findOne({
            key: rankingKey,

        })


        if (!foundKey) {
            return reply.status(401).send({
                success: false,
                reason: 'Unauthorized'
            })
        }
        const groupRoles = await readminCollections.group_role.find({ groupId: foundKey.groupId });
        const robloxBot = await readminCollections.group_oauth_authorization.findOne({ groupId: foundKey.groupId });

        if (!robloxBot) {
            return reply.status(400).send({
                success: false,
                reason: 'Roblox bot not linked.'
            })
        }

        request.RankingKey = foundKey;
        request.GroupRoles = await groupRoles.toArray();
        request.RobloxBot = robloxBot;
        return;
    })
}

export default fp(rankingKeyHook);