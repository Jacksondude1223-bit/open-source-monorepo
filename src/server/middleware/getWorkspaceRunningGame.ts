import { TRPCError } from '@trpc/server';
import getWorkspaceGame from './getWorkspaceGame';
import { z } from 'zod';
import { readminCollections } from '~/services/mongo.service';;
import StringToObjectID from '~/utils/StringToObjectID';

export default getWorkspaceGame.unstable_pipe(
  async ({ ctx, getRawInput, next }) => {
    const rawInput = await getRawInput();
    const result = z
      .object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
      })
      .safeParse(rawInput);
    if (!result) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Bad request',
      });
    }
    const { user, workspace, game } = ctx;
    const { serverId }: { serverId?: string } = rawInput as any;
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not logged in.',
      });
    }
    if (!serverId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Server not found',
      });
    }
    const foundRunning = await readminCollections.running_games.findOne({
      groupId: workspace.groupId,
      placeId: game.placeId,
      _id: StringToObjectID(serverId) // soon to move to runningGameId
    });

    if (!foundRunning) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Server not found',
      });
    }

    if (!workspace?.premium?.is) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Workspace must be premium to use this endpoint',
      });
    }

    return next({
      ctx: {
        running: foundRunning,
      },
    });
  },
);
