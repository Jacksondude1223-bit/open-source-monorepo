import { readminCollections } from '~/services/mongo.service';
import { getGroupInfo } from '~/services/roblox.service';
import { FastifyRequest, FastifyReply } from 'fastify';


export const getWorkspace = async (req: FastifyRequest<{
}>, res: FastifyReply) => {
    const workspace = req.workspace;

    try {

        const applications = await readminCollections.application.find({
            groupId: workspace.groupId,
        });

        const now = Date.now();

        return res.send({
            success: true,
            workspace,
            applications: (await applications.toArray()).map((a) => {
                // Compute whether the response window is currently closed, mirroring
                // the public apply page (applyOnline.getCenterById) so the in-game
                // Application Center honours the same scheduling settings.
                const responseWindow = a.responseWindow;
                let windowClosed = false;
                if (responseWindow?.enabled) {
                    if (responseWindow.start && now < new Date(responseWindow.start).getTime()) {
                        windowClosed = true;
                    }
                    if (responseWindow.end && now > new Date(responseWindow.end).getTime()) {
                        windowClosed = true;
                    }
                }
                // The in-game center should only surface forms that accept the game channel.
                const gameChannelDisabled = a.responseChannels?.game === false;

                return {
                    ...a,
                    autoGrading: { enabled: a.autoGrading.enabled },
                    automations: {},
                    windowClosed,
                    gameChannelDisabled,
                };
            }),
            info: await getGroupInfo(workspace.groupId),
        })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};