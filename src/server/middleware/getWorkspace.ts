import { TRPCError } from '@trpc/server';
import { middleware } from '~/server/trpc';
import { getUserWorkspace } from '~/services/workspaces.service';
import {
  getGroupInfo,
  getGroupThumbnail,
} from '~/services/roblox.service';
import { z } from 'zod';

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
      message: 'Group ID was not provided',
    });
  }
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You are not logged in.',
    });
  }
  const { groupId } = rawInput as { groupId: string };
  if (!groupId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Group ID was not provided.',
    });
  }
  if (!user.dbUser.robloxId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must have a verified Roblox account.',
    });
  }

  try {
    const [userWorkspace, groupInfo] = await Promise.all([
      getUserWorkspace(groupId, user),
      getGroupInfo(groupId),
    ]);

    if (user.dbUser.isModerated !== false) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You are not allowed to access ReAdmin at this time.',
      });
    }

    return next({
      ctx: {
        user: user,
        workspace: userWorkspace.workspace,
        group: {
          ...groupInfo,
          thumbnail: await getGroupThumbnail(userWorkspace.workspace.groupId),
        },
        department: userWorkspace.department
      },
    });
  } catch (e: string | any) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: (e as string).toString() || 'An error occurred while fetching the workspace. If you were linked here, you may not have access to this workspace.',
    });
  }
});
