import { readminCollections } from '~/services/mongo.service';
import fastify, { FastifyRequest, FastifyReply } from 'fastify';
export const reportError = async (req: FastifyRequest<{
    Headers: { ['roblox-id']: string; };
    Body: { errors: any; };
}>, res: FastifyReply) => {
    try {
        const headers = req.headers;
        const body = req.body;
        const workspace = req.workspace;
        const { errors } = body;

        if (!Array.isArray(errors)) {
            return res.status(400).send({ success: false, reason: 'Invalid request body' })
        }

        for (const error of errors) {
            await readminCollections.readmin_module_error_report.insertOne({
                groupId: workspace.groupId,
                robloxId: headers['roblox-id'],
                //@ts-expect-error lol
                headers,
                error,
                created: new Date()
            })
        }



        return res.send({ success: true })
    } catch (e) {
        console.error('Report Error...error', e);
        console.error(e);
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};