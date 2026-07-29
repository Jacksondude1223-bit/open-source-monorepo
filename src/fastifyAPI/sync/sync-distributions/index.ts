import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { Workspace } from '~/services/NewMongoTypes';
import moment from 'moment-timezone';
import newDistributionMessaging from './newDistributionMessaging';
import { emitFlowEvent } from '~/services/flows/flowEngine.service';

const daysToMilliseconds = (days: number): number => days * 24 * 60 * 60 * 1000;

// Minimum number of days that must elapse since the last distribution before the
// next one is allowed. Slightly under the period length to account for drift.
const periods = {
    weekly: 6.9,
    biweekly: 13.9,
    monthly: 27.9,
};

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_DAY = 0; // Sunday

export const syncDistributions = async () => {
    sendReAdminInternalWebhookMessage('distributions', 'blue', 'Syncing Distributions', 'Syncing has began');

    const workspaces = await readminCollections.workspace.find({
        "premium.is": true,
        distributionPeriod: { $ne: "manual" },
    }).toArray();

    await Promise.all(workspaces.map(async workspace => {
        const period = workspace.distributionPeriod as 'weekly' | 'biweekly' | 'monthly';
        const periodInDays = periods[period];
        if (!periodInDays) {
            return;
        }

        const timezone = (workspace.distributionTimezone && moment.tz.zone(workspace.distributionTimezone))
            ? workspace.distributionTimezone
            : DEFAULT_TIMEZONE;
        const desiredDay = typeof workspace.distributionDay === 'number'
            ? workspace.distributionDay
            : DEFAULT_DAY;

        // Distributions run at midnight (00:xx) on the configured day in the configured timezone.
        // This sync runs hourly, so we only proceed during the local midnight hour of the target day.
        const nowInTz = moment().tz(timezone);
        if (nowInTz.day() !== desiredDay || nowInTz.hour() !== 0) {
            return;
        }

        const currentDistribution = await readminCollections.distribution.findOne({
            groupId: workspace.groupId,
            isCurrent: true,
        });

        if (!currentDistribution) {
            return;
        }

        // Ensure enough of the period has elapsed since the last distribution so that
        // biweekly/monthly cadences don't fire every matching weekday.
        const lastFrom = new Date(currentDistribution.from);
        const cutOffDate = new Date(lastFrom.getTime() + daysToMilliseconds(periodInDays));
        if (new Date() < cutOffDate) {
            return;
        }

        sendReAdminInternalWebhookMessage('distributions', 'blue', 'Syncing Distributions', `Syncing distribution for ${workspace?.groupName} (${workspace.groupId})`);

        // Distribute

        await Promise.all([
            readminCollections.distribution.updateOne(
                {
                    _id: currentDistribution._id,
                },
                {
                    $set: {
                        isCurrent: false,
                        to: new Date(),
                    },
                }
            ),
            readminCollections.distribution.insertOne({
                groupId: workspace.groupId,
                num: currentDistribution.num + 1,
                from: new Date(),
                isCurrent: true,
                automated: true,
                created: new Date(),
            }),
        ]);

        // Notify Flows that a new distribution period has opened.
        emitFlowEvent({
            groupId: workspace.groupId,
            type: 'distribution.started',
            event: {
                distribution: currentDistribution.num + 1,
                previousDistribution: currentDistribution.num,
            },
        });

        await newDistributionMessaging((await readminCollections.workspace.findOne({ groupId: workspace.groupId })) as Workspace, currentDistribution.num);
    }));
    sendReAdminInternalWebhookMessage('distributions', 'blue', 'Syncing Distributions', 'Syncing has ended');
};