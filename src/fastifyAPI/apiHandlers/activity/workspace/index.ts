import { FastifyRequest, FastifyReply } from 'fastify';


export const getWorkspace = async (req: FastifyRequest<{
    Body: {};
}>, res: FastifyReply) => {
    const workspace = req.workspace;

    return res.send({
        success: true,
        workspace
    })
};