import { TRPCError } from '@trpc/server';
import { middleware } from '~/server/trpc';

export default middleware(async ({ ctx, next }) => {
  if (ctx.user == undefined) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User must be authorized to use this endpoint.',
    });
  }
  if (!(['Customer Service', 'Founder'].includes(ctx?.user?.dbUser?.role))){
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User must be a customer service rep..',
    });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});
