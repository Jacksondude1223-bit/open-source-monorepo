import { TRPCError } from '@trpc/server';
import getWorkspace from './getWorkspace';
import { z } from 'zod';
import { readminCollections } from '~/services/mongo.service';;

export default getWorkspace.unstable_pipe(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();
  const result = z
    .object({
      groupId: z.string(),
      gameId: z.string(),
    })
    .safeParse(rawInput);
  if (!result) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Bad request',
    });
  }
  const { user, workspace } = ctx;
  const { gameId }: { gameId?: string } = rawInput as any;
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not logged in.',
    });
  }
  if (!gameId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Game not found',
    });
  }
  const foundGame = await readminCollections.game.findOne({
    groupId: workspace.groupId,
    placeId: parseInt(gameId),
  });

  if (!foundGame) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Game not found',
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
      game: foundGame,
    },
  });
});
