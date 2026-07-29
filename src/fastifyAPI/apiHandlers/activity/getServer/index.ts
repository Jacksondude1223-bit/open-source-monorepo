import { FastifyRequest, FastifyReply } from 'fastify';


export const getServer = async (req: FastifyRequest<{
    Headers: { ['loader-id']: string;['roblox-id']: string; };
    Body: { gameId: string; };
}>, res: FastifyReply) => {
    const headers = req.headers;
    const body = req.body;
    const { workspace, runningGame } = req;

    return res.send({
        success: true,
        workspace
    })
};