import { APIInteraction, InteractionType } from 'discord.js';
import { env } from '~/services/env';
import handleInteraction from './discordHandler/interactionHandler';
import { FastifyRequest, FastifyReply } from 'fastify';
import { verify } from "discord-verify/node";

export const discordHandler = async (req: FastifyRequest<{
    Headers: { ['x-signature-ed25519']: string;['x-signature-timestamp']: string; };
}>, res: FastifyReply) => {
    try {
        const { headers, body } = req;
        const signature = headers['x-signature-ed25519'];
        const timestamp = headers['x-signature-timestamp'];
        if (!signature || !timestamp) {
            return res.status(400).send({
                message: "invalid request signature"
            })
        }
        const rawBody = JSON.stringify(req.body);
        const isValidRequest = await verify(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY, crypto.subtle);
        if (!isValidRequest) {
            return res.status(400).send({
                message: "invalid request signature"
            })
        }
        const message = body as APIInteraction;
        const type = message.type;
        if (type == InteractionType.Ping) {
            return res.send({
                type: 1
            });
        }
        const resp = await handleInteraction(message as APIInteraction as any);
        return res.send(resp);
    } catch (e) {
        console.error(e);
        return res.status(500).send({
            message: "Internal server error"
        })
    }
};