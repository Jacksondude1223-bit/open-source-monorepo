import Stripe from "stripe";
import { env } from "~/services/env";
import stripeService from "~/services/stripe.service";
import { sendReAdminInternalWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import { FastifyReply, FastifyRequest } from 'fastify';

export type WorkspaceMetadata = { subscriberRobloxId: string; workspaceId: string };

export const billingHandler = async (req: FastifyRequest<{
    Headers: { ['stripe-signature']?: string;['Stripe-Signature']?: string; };
    Body: any;
}>, res: FastifyReply) => {
    try {
        let stripeEvent: Stripe.Event = {} as Stripe.Event;
        const { headers } = req;
        const signature = headers['Stripe-Signature'] || headers['stripe-signature'];
        if (!signature) {
            sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Webhook missing signature.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
            return res.status(401).send({ error: 'Webhook missing signature' });
        }
        try {
            // stripeService.webhooks.constructEventAsync
            stripeEvent = stripeService.webhooks.constructEvent(
                req.rawBody as any,
                signature,
                env.STRIPE_SIGNING_SECRET,
                300
            );
            sendReAdminInternalWebhookMessage('billing', 'green', `Processing new stripe Event ${stripeEvent.type}`, `stripeEvent ID: ${stripeEvent.id}`);
        } catch (err: any) {
            sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Webhook signature verification failed.`, err?.message || '');
            return res.status(401).send({ error: 'Webhook signature verification failed' });
        }

        if (stripeEvent.type == 'customer.subscription.created') {
            /*
            Purpose: Handle when a user subscribes to a plan -- this is just used for loggin purposes
            Docs: Sent when the subscription is created. The subscription status might be incomplete if customer authentication is required to complete the payment or if you set payment_behavior to default_incomplete. View subscription payment behavior to learn more
            */
            const customerSubscriptionCreated = stripeEvent.data.object;
            const metadata = customerSubscriptionCreated.metadata as WorkspaceMetadata;

            sendReAdminInternalWebhookMessage('billing', 'green', `Subscription created`, `Group ID: ${metadata.workspaceId} \n User ID: ${metadata.subscriberRobloxId}`);

            return res.send({ received: true });
        }

        if (stripeEvent.type == 'customer.subscription.deleted') {
            /*
            Purpose: Handle when a user cancels their subscription and the duration runs out on it, should remove the premium status from the workspace
            Docs: Sent when a customer’s subscription ends.
            */
            const customerSubscriptionDeleted = stripeEvent.data.object;
            const metadata = customerSubscriptionDeleted.metadata as WorkspaceMetadata;
            const groupId = metadata?.workspaceId || null;
            if (!groupId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Subscription missing group id.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ error: 'Webhook missing group ID' });
            }
            const workspace = await readminCollections.workspace.findOne({ groupId });
            if (!workspace) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Workspace missing for ${groupId}.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ error: 'Subscription missing workspace in our database' });
            }
            await readminCollections.workspace.updateOne(
                {
                    groupId: groupId.toString(),
                },
                {
                    $set: {
                        premium: {
                            is: false,
                        },
                    },
                }
            );
            sendReAdminInternalWebhookMessage('billing', 'orange', `Subscription ended / deleted`, `Group ID: ${groupId}`);
            return res.send({ received: true });
        }
        if (stripeEvent.type == 'invoice.payment_failed') {
            // Docs: A payment for an invoice failed. The PaymentIntent status changes to requires_action. The status of the subscription continues to be incomplete only for the subscription’s first invoice. If a payment fails, there are several possible actions to take:
            // Purpose: Ban a user and workspace if they fail to pay their invoice
            if (!stripeEvent.data.object.lines.data[0]) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Subscription missing details.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'missing susbcription details' });
            }
            const metadata = stripeEvent.data.object.lines.data[0].metadata as WorkspaceMetadata;
            if (!metadata.workspaceId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Subscription missing workspace id.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'missing workspace id' });
            }
            if (!metadata.subscriberRobloxId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Subscription missing subscriber roblox id.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'missing subscriber roblox id' });
            }
            const workspace = await readminCollections.workspace.findOne({ groupId: metadata.workspaceId });
            if (!workspace) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Workspace not found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'workspace not found' });
            }
            if (workspace.banStatus?.is && workspace.banStatus?.bannedBy == 'billing') {
                return res.send({ received: true, reason: 'workspace is already banned' });
            }
            const user = await readminCollections.user.findOne({ robloxId: metadata.subscriberRobloxId });
            if (!user) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  User not found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'user not found' });
            }
            if (user?.isModerated !== false && user?.isModerated?.is == true) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  User is already moderated but just had nonpayment.`, `User Id: ${user.robloxId}\nUser Name: ${user.name}\nGroup ID: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}. User ban has been changed from ${user.isModerated.reason} -- this may need changing back. @everyone`);
            }

            sendReAdminInternalWebhookMessage('billing', 'orange', `⚠️  Invoice payment failed - user/workspace is being banned.`, `Group Id: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}`);

            await readminCollections.workspace.updateOne({
                groupId: metadata.workspaceId.toString(),
            }, {
                $set: {
                    premium: {
                        is: false,
                    },
                    banStatus: {
                        is: true,
                        reason: `${workspace.banStatus ? `${workspace.banStatus?.reason} / ` : ''}Subscription payment failed - ${user?.name || user?.robloxId} must pay invoice for ReAdmin workspace to be reinstated.`,
                        bannedBy: 'billing',
                    }
                },
            });
            await readminCollections.user.updateOne({
                robloxId: metadata.subscriberRobloxId.toString(),
            },
                {
                    $set: {
                        isModerated: {
                            is: true,
                            type: 'ban',
                            reason: `${user?.isModerated ? `${user.isModerated.reason} / ` : ''}Subscription payment failed - ${workspace?.groupName || workspace?.groupId}'s invoice must be paid for ReAdmin workspace and your account to be reinstated.`,
                            invoiceUrl: stripeEvent.data.object.hosted_invoice_url || '',
                            bannedBy: 'billing',
                        },
                    },
                });
            sendReAdminInternalWebhookMessage('billing', 'orange', `⚠️  Invoice payment failed - user/workspace have been banned.`, `Group Id: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}\nUser Id: ${user.robloxId}\nUser Name: ${user.name}`);

            return res.send({ received: true });
        }
        if (stripeEvent.type == 'invoice.payment_succeeded') {
            //Docs: Sent when a PaymentIntent has successfully completed payment.
            //Purpose: Remove the ban from a user and workspace if they pay their invoice, do not remove ban if they are banned for other reason (banned by is not billing). Also to log payments
            // console.log('event', JSON.stringify(stripeEvent))

            const invoiceId = stripeEvent.data.object.id?.toString() || '';
            if (!invoiceId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Invoice payment succeeded but no invoice ID found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'no invoice id found' });
            }
            const invoiceInfo = await stripeService.invoices.retrieve(invoiceId);
            if (!invoiceInfo) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Invoice payment succeeded but no invoice info found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'no invoice info found' });
            }
            const subscriptionData = await stripeService.subscriptions.retrieve(invoiceInfo.parent?.subscription_details?.subscription.toString() || '');

            const metadata = subscriptionData.metadata as WorkspaceMetadata;
            if (!metadata.workspaceId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Invoice missing workspace id.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'missing workspace id' });
            }
            if (!metadata.subscriberRobloxId) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Invoice missing subscriber roblox id.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'missing subscriber roblox id' });
            }
            const workspace = await readminCollections.workspace.findOne({ groupId: metadata.workspaceId });
            if (!workspace) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Workspace not found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'workspace not found' });
            }
            const user = await readminCollections.user.findOne({ robloxId: metadata.subscriberRobloxId });
            if (!user) {
                sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  User not found.`, `stripeEvent ID: ${stripeEvent.id} - ${stripeEvent.type}`);
                return res.status(400).send({ received: true, reason: 'user not found' });
            }

            if (workspace.banStatus?.is && workspace.banStatus?.bannedBy == 'billing') {
                await readminCollections.workspace.updateOne({
                    groupId: metadata.workspaceId.toString(),
                }, {
                    $unset: {
                        banStatus: true
                    },
                });
                sendReAdminInternalWebhookMessage('billing', 'green', `Payment succeeded - workspace unbanned`, `Group Id: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}\nUser Id: ${user.robloxId}\nUser Name: ${user.name}`);

            }
            if (user?.isModerated !== false && user?.isModerated?.is == true && user?.isModerated?.bannedBy == 'billing') {
                await readminCollections.user.updateOne({
                    robloxId: metadata.subscriberRobloxId.toString(),
                },
                    {
                        $set: {
                            isModerated: false
                        },
                    });
                sendReAdminInternalWebhookMessage('billing', 'green', `Payment succeeded - user unbanned`, `Group Id: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}\nUser Id: ${user.robloxId}\nUser Name: ${user.name}`);
            }
            sendReAdminInternalWebhookMessage('billing', 'green', `Payment collected`, `Group Id: ${workspace.groupId}\nGroup Name: ${workspace?.groupName}\nUser Id: ${user.robloxId}\nUser Name: ${user.name}`);

            return res.send({ received: true });
        }
        sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  DID NOT PROCESS.`, `${stripeEvent.type} - ${stripeEvent.id}`);
        return res.send({ processed: false, type: stripeEvent.type });
    } catch (e) {
        console.error(e);
        sendReAdminInternalWebhookMessage('billing', `red`, `⚠️  Internal server error.`, `An error occurred while processing the stripe event ${(e as any)?.raw?.message || e?.toString()}`);
        return res.status(500).send({ error: 'Internal server error' });
    }
};