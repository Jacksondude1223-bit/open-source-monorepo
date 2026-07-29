import { env } from '~/services/env';
import { generateSecureString } from '~/services/Crypto-service.service';
import { getRobloxGameInfo, getRobloxGameIcon, getRobloxGameThumbnail } from '~/services/roblox.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { v4 } from 'uuid';
import { readminCollections } from '~/services/mongo.service';
import { FastifyReply, FastifyRequest } from 'fastify';

const allowStudioTesting = false;


const safePromise = <T, ErrorResult>(promise: Promise<T>, errorResult: ErrorResult): Promise<T | ErrorResult> => {
    return promise
        .then((data) => data as T)
        .catch((err) => errorResult as ErrorResult);
}

export const createServer = async (
    req: FastifyRequest<{
        Body: { gameId: number, placeId: number, jobId: string, privateServerId: string, privateServerOwnerId: number, placeVersion: number; };
    }>,
    res: FastifyReply
) => {
    const body = req.body;
    const workspace = req.workspace;
    const { groupId } = workspace;
    const {
        gameId,
        placeId,
        jobId,
        privateServerId,
        privateServerOwnerId,
        placeVersion,
    } = body;


    if (jobId == '' && !allowStudioTesting) {
        return res.status(400).send({
            success: false,
            reason: "Job ID was not provided - must not run in studio.",
        });
    }

    try {

        if (!workspace?.premium?.is) {
            return res.status(401).send({
                success: false,
                reason: "ReAdmin premium is required to track games.",
            });
        }



        // Create the running game
        const internalGameId = `RA-GAMES-${await generateSecureString(10)}-${v4()}`;


        const createdRunningGameId = await readminCollections.running_games.insertOne({
            version: env.COMMIT_HASH ? `${env.COMMIT_HASH}` : "ranking-api-0.0.3",
            groupId,
            internalGameId,
            privateServerId,
            privateServerOwnerId,
            placeVersion,
            gameId,
            placeId,
            jobId,
            players: [],
            created: new Date(),
            lastPing: new Date(),
        })

        const [gameInfo, icon, thumbnail, foundGame] = await Promise.all([
            safePromise(getRobloxGameInfo(gameId.toString()), {
                displayName: 'Unknown'
            }),
            safePromise(getRobloxGameIcon(gameId.toString()), ''),
            safePromise(getRobloxGameThumbnail(gameId.toString()), ''),
            readminCollections.game.findOne({
                groupId,
                gameId,
                placeId,
            })
        ]);

        if (!foundGame) {
            await readminCollections.game.insertOne({
                groupId,
                gameId,
                placeId,
                name: gameInfo?.displayName || 'Unknown',
                viewable: false,
                images: {
                    icon,
                    thumbnail,
                },
                lastSeen: new Date(),
                created: new Date(),
            });
        }

        if (gameInfo?.displayName !== 'Unknown') {
            await readminCollections.game.updateOne(
                {
                    _id: foundGame?._id
                },
                {
                    $set: {
                        name: gameInfo?.displayName,
                        images: {
                            icon,
                            thumbnail,
                        },
                        lastSeen: new Date(),
                    }
                },
            );
        }

        return res.send({
            success: true,
            gameId: internalGameId,
            runningGameId: createdRunningGameId.insertedId,
            workspace,
            // Surfaced explicitly so the game can read each player's group rank/
            // role off the Player instance (GetRankInGroup) — the scoped-ID-proof
            // staff-detection fallback sent back at playerJoin.
            groupId: workspace.groupId,
            // Group display name, shown in the in-game consent prompt.
            groupName: workspace.groupName,
            moderation: workspace.enableModerationDashboard || false,
            afkReportingSettings: workspace.afkReportingSettings || {
                altTab: { active: true },
                movement: { active: true },
            },
            applicationCenter: {
                enabled: workspace.applicationCenterSettings?.enabled || false,
                displayMode: workspace.applicationCenterSettings?.displayMode || 'windowed',
                backdrop: workspace.applicationCenterSettings?.backdrop || false,
            },
            // Activity-tracking privacy mode (Roblox scoped-ID rollout). Both
            // default off → unchanged behaviour until a workspace enables them.
            privacy: {
                trackStaffOnly: workspace.privacySettings?.trackStaffOnly || false,
                requireConsent: workspace.privacySettings?.requireConsent || false,
            },
        });

    } catch (e) {
        console.error('Create Server Error', e);
        console.error(e);
        console.error('Create Server Error');
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Create Server Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal Server Error' })
    }
};