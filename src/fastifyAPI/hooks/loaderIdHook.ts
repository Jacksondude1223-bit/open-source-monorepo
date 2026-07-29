import { FastifyInstance, FastifyRequest } from "fastify";
import { readminCollections } from "~/services/mongo.service";
import fp from 'fastify-plugin';

function loaderIdHook(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (request: FastifyRequest<{
        Headers: { ['loader-id']: string };
    }>, reply) => {

        if (reply?.routeOptions?.config?.workspaceFromLoaderId !== true) {
            return;
        }

        const loaderId = request.headers["loader-id"];
        if (!loaderId) {
            return reply.status(401).send({
                success: false,
                reason: "Loader ID header was not provided.",
            });
        }

        const workspace = await readminCollections.workspace.findOne({ loaderId });

        if (!workspace) {
            return reply.status(401).send({ success: false, reason: "Workspace not found" });
        }

        request.workspace = workspace;

        return;
    })
}

export default fp(loaderIdHook);