import fp from 'fastify-plugin';
import { activityRouter } from "./activity";
import { applicationsRouter } from "./applications";
import { callsRouter } from "./calls";
import { filesRouter } from "./files";
import { gamesRouter } from "./games";
import { internalRouter } from "./internal";
import { ordersV2Router } from "./ordersV2";
import { promotionRequestsRouter } from "./promotionRequests";
import { rankingRouter } from "./ranking";
import { sessionsRouter } from "./sessions";
import { sessionsV2Router } from "./sessionsV2";
import { staffRouter } from "./staff";
import { teamsRouter } from "./teams";
import { timeOffRouter } from "./timeOff";
import { usersRouter } from "./users";

const started = new Date().getTime()

export const defaultRouter = fp(async (fastify) => {
    fastify.register(activityRouter, { prefix: '/activity' })
    fastify.register(applicationsRouter, { prefix: '/applications' })
    fastify.register(callsRouter, { prefix: '/calls' })
    fastify.register(filesRouter, { prefix: '/files' })
    fastify.register(gamesRouter, { prefix: '/games' })
    fastify.register(internalRouter, { prefix: '/internal' })
    fastify.register(ordersV2Router, { prefix: '/v2' })
    fastify.register(promotionRequestsRouter, { prefix: '/promotion-requests' })
    fastify.register(rankingRouter, { prefix: '/ranking' })
    fastify.register(sessionsRouter, { prefix: '/sessions' })
    fastify.register(sessionsV2Router)
    fastify.register(staffRouter, { prefix: '/staff' })
    fastify.register(teamsRouter, { prefix: '/teams' })
    fastify.register(timeOffRouter, { prefix: '/time-off' })
    fastify.register(usersRouter, { prefix: '/users' })


    fastify.get('/', (req, reply) => {
        reply.send({
            success: true,
            message: 'ReAdmin API',
            version: '1.0.0',
            fallBack: false,
            d: started
        })
    })
});