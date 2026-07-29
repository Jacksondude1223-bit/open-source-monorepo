import superjson from 'superjson';
import { Context } from './context';
import { initTRPC } from '@trpc/server';

const t = initTRPC
  .context<Context>()
  .create({
    transformer: superjson,
    errorFormatter({ shape }) {
      return {
        success: false,
        ...shape,
      };
    },
  });

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;