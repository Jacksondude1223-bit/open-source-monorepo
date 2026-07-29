import { z } from 'zod';
import { founderProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import stripeService from '~/services/stripe.service';
import { router } from '~/server/trpc';

export const adminWorkspacesRouter = router({
  getWorkspaces: founderProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    const workspaces = await readminCollections.workspace.find({}, {
      projection: {
        _id: 1,
        groupId: 1,
        groupName: 1,
        created: 1,
        banStatus: 1,
        premium: 1,
        owner: 1,
      }, sort: { created: -1 }
    }).toArray();
    return workspaces;
  }),
  transferWorkspace: founderProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { groupId, userId } = input;
    const foundUser = await readminCollections.user.findOne({ robloxId: userId.toString() });
    if (!foundUser) throw new Error('User not found');
    const workspace = await readminCollections.workspace.findOne({ groupId: groupId });
    if (!workspace) throw new Error('Workspace not found');
    await readminCollections.workspace.updateOne({ _id: workspace._id }, {
      $set: {
        owner: {
          robloxId: userId.toString(),
          reAdminId: foundUser._id,
        }
      }
    })
    return true;
  }),
  banWorkspace: founderProcedure.input(z.object({
    groupId: z.string(),
    reason: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { groupId, reason } = input;
    const workspace = await readminCollections.workspace.findOne({ groupId: groupId });
    if (!workspace) throw new Error('Workspace not found');
    await readminCollections.workspace.updateOne({ groupId: groupId }, { $set: { banStatus: { is: true, reason: reason, bannedBy: user.dbUser.robloxId } } });
    return true;
  }),
  unbanWorkspace: founderProcedure.input(z.object({
    groupId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { groupId } = input;
    const workspace = await readminCollections.workspace.findOne({ groupId: groupId });
    if (!workspace) throw new Error('Workspace not found');
    await readminCollections.workspace.updateOne({ groupId: groupId }, { $unset: { banStatus: '' } });
    return true;
  }),
  deleteWorkspace: founderProcedure.input(z.object({
    groupId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { groupId } = input;
    const workspace = await readminCollections.workspace.findOne({ groupId: groupId });
    if (user.dbUser.robloxId !== '25482574' && user.dbUser.robloxId !== '66068322') throw new Error('You do not have permission to delete workspaces');
    if (!workspace) throw new Error('Workspace not found');
    if (!groupId || groupId == '0') throw new Error('Invalid groupId');
    if (workspace.premium.is) {
      if (workspace.premium.subscriptionId) {
        await stripeService.subscriptions.cancel(workspace.premium.subscriptionId, { prorate: true });
      }
    }
    await Promise.all([
      readminCollections.activity_requirements.deleteMany({ groupId }),
      readminCollections.application.deleteMany({ groupId }),
      readminCollections.department.deleteMany({ groupId }),
      readminCollections.department_role.deleteMany({ groupId }),
      readminCollections.department_users.deleteMany({ groupId }),
      readminCollections.discord_bots.deleteMany({ groupId }),
      readminCollections.discord_logging.deleteMany({ groupId }),
      readminCollections.distribution.deleteMany({ groupId }),
      readminCollections.hub_resource.deleteMany({ groupId }),
      readminCollections.hub_container.deleteMany({ groupId }),
      readminCollections.hub_resource_open.deleteMany({ groupId }),
      readminCollections.game.deleteMany({ groupId }),
      readminCollections.group_audit_log.deleteMany({ groupId }),
      readminCollections.group_member.deleteMany({ groupId }),
      readminCollections.group_oauth_authorization.deleteMany({ groupId }),
      readminCollections.group_role.deleteMany({ groupId }),
      readminCollections.inactivity.deleteMany({ groupId }),
      readminCollections.manual_minutes.deleteMany({ groupId }),
      readminCollections.queued_game_action.deleteMany({ groupId }),
      readminCollections.ranking_key.deleteMany({ groupId }),
      readminCollections.response.deleteMany({ groupId }),
      readminCollections.roblox_bots.deleteMany({ groupId }),
      readminCollections.roblox_group_action_queue.deleteMany({ groupId }),
      readminCollections.running_game_players.deleteMany({ groupId }),
      readminCollections.running_game_chats.deleteMany({ groupId }),
      readminCollections.running_games.deleteMany({ groupId }),
      readminCollections.session.deleteMany({ groupId }),
      readminCollections.session_roles.deleteMany({ groupId }),
      readminCollections.sessions_template.deleteMany({ groupId }),
      readminCollections.site_alert.deleteMany({ groupId }),
      readminCollections.feed.deleteMany({ groupId }),
      readminCollections.task.deleteMany({ groupId }),
      readminCollections.in_game_support_ticket.deleteMany({ groupId }),
      readminCollections.user_game_session.deleteMany({ groupId: parseInt(groupId) }),
      readminCollections.user_game_session_distribution_summary.deleteMany({ groupId }),
      readminCollections.user_game_session_yearly_summary.deleteMany({ groupId }),
      readminCollections.user_note.deleteMany({ groupId }),
      readminCollections.workspace.deleteMany({ groupId }),
      readminCollections.workspace_bans.deleteMany({ groupId }),
      readminCollections.workspace_tag.deleteMany({ groupId }),
      readminCollections.workspace_tag_member.deleteMany({ groupId }),
      readminCollections.workspace_view.deleteMany({ groupId }),
      readminCollections.workspace_view_export.deleteMany({ groupId }),
      readminCollections.write_ups.deleteMany({ groupId }),
      readminCollections.orders.deleteMany({ groupId }),
    ])
    return true;
  }),
})
