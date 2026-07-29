import { middleware } from '~/server/trpc';

export default middleware(async ({ next }) => {
  return next();
});
