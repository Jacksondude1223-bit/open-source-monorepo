import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';
import { TimeOffStatus } from '~/services/NewMongoTypes/TimeOffRequest.type';

// Shared logic for approving / declining a time off request from the public API.
// actorId is the Roblox id of the staff member making the decision.
export const reviewTimeOffRequest = async (
    req: FastifyRequest<{
        Params: { requestId: string };
        Body: { actorId: string; note?: string };
    }>,
    res: FastifyReply,
    decision: Extract<TimeOffStatus, 'approved' | 'denied'>,
) => {
    const { workspace, body } = req;
    const { requestId } = req.params;
    const actorId = body?.actorId;
    const note = body?.note;

    if (!requestId) {
        return res.status(400).send({ success: false, reason: 'Request ID was not provided' });
    }
    if (!actorId) {
        return res.status(400).send({ success: false, reason: 'actorId was not provided' });
    }

    try {
        const request = await readminCollections.time_off_request.findOne({
            _id: StringToObjectID(requestId),
            groupId: workspace.groupId,
        });

        if (!request) {
            return res.status(404).send({ success: false, reason: 'Time off request not found' });
        }
        if (request.status !== 'pending') {
            return res.status(400).send({ success: false, reason: 'This request has already been reviewed' });
        }

        await readminCollections.time_off_request.updateOne({
            _id: request._id,
            groupId: workspace.groupId,
        }, {
            $set: {
                status: decision,
                reviewedBy: actorId,
                reviewedAt: new Date(),
                ...(note ? { reviewNote: note } : {}),
            },
        });

        const updated = await readminCollections.time_off_request.findOne({ _id: request._id });

        return res.send({ success: true, request: updated });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
