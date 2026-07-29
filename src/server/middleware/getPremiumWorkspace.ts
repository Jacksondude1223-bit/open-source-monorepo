import { TRPCError } from '@trpc/server';
import { middleware } from '~/server/trpc';
import { getUserWorkspace } from '~/services/workspaces.service';
import {
  getGroupInfo,
  getGroupThumbnail,
} from '~/services/roblox.service';
import { z } from 'zod';
import { readminCollections } from '~/services/mongo.service';

export default middleware(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();

  const result = z
    .object({
      groupId: z.string(),
    })
    .safeParse(rawInput);
  if (!result) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Bad request',
    });
  }
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not logged in.',
    });
  }
  const { groupId } = rawInput as { groupId: string };
  if (!groupId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'GroupID not provided.',
    });
  }
  if (!user.dbUser.robloxId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User must have a verified Roblox account.',
    });
  }

  const [userWorkspace, groupInfo] = await Promise.all([
    getUserWorkspace(groupId, user),
    getGroupInfo(groupId),
  ]);

  if (user.dbUser?.isModerated !== false && user.dbUser?.isModerated?.is == true) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User is moderated',
    });
  }

  if (!userWorkspace?.workspace?.premium?.is) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Workspace must be premium to use this endpoint',
    });
  }

  const groupMember = await readminCollections.group_member.findOne({ groupId: userWorkspace.workspace.groupId, userId: parseInt(user.dbUser.robloxId || '0') })
  const groupRole = await readminCollections.group_role.findOne({ groupId: userWorkspace.workspace.groupId, rank: groupMember?.rankId })

  return next({
    ctx: {
      user: user,
      workspace: userWorkspace.workspace,
      group: {
        ...groupInfo,
        thumbnail: await getGroupThumbnail(userWorkspace.workspace.groupId),
      },
      department: userWorkspace.department,
      userRole: groupRole
    },
  });
});
