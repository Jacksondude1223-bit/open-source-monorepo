import { createCallerFactory, router } from '~/server/trpc';
import { authRouter } from './auth/auth';
import { robloxRouter } from './roblox';
import { userRouter } from './user/user';
import { workspacesRouter } from './workspaces/workspaces';
import { applyOnlineRouter } from './applyOnline/applyOnline';
import { adminRouter } from './admin/admin';
import { postingsRouter } from './postings/postings';
import { resumeRouter } from './resume/resume';
import { identityLinkRouter } from './identityLink/identityLink';
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { GetServerSidePropsContext, PreviewData } from 'next';
import { ParsedUrlQuery } from 'querystring';
import { checkJWT } from '~/services/auth.service';

export const appRouter = router({
  admin: adminRouter,
  auth: authRouter,
  user: userRouter,
  roblox: robloxRouter,
  workspaces: workspacesRouter,
  applyOnline: applyOnlineRouter,
  postings: postingsRouter,
  resume: resumeRouter,
  identityLink: identityLinkRouter,
})

export type AppRouter = typeof appRouter;
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
export type ArrayToValueType<A> = A extends readonly (infer T)[] ? T : never;

const createCaller = createCallerFactory(appRouter);
export const caller = createCaller({ user: null, host: null });

export const createAuthedCaller = async (reqContext: GetServerSidePropsContext<ParsedUrlQuery, PreviewData>) => {
  if (!reqContext.req.cookies['ReAdmin_Session']) {
    return false;
  }
  const user = await checkJWT(reqContext.req.cookies['ReAdmin_Session']);
  return createCaller({ user, host: reqContext.req.headers.host ?? null });
}