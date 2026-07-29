import * as trpcNext from '@trpc/server/adapters/next';
import { JWTUser } from '~/services/types/JWT.type';
import { checkJWT } from '~/services/auth.service';
import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

interface CreateContextOptions {
  user: JWTUser | null;
  /** Host the request came in on, used to tell readmin.app apart from self-hosted deployments. */
  host: string | null;
}

export async function createContextInner(_opts: CreateContextOptions) {
  return {
    user: _opts.user,
    host: _opts.host,
  };
}

export type Context = Awaited<ReturnType<typeof createContextInner>>

export async function createContext({
  req,
}: trpcNext.CreateNextContextOptions|CreateFastifyContextOptions): Promise<Context> {
  const cookie = req.headers.cookie;
  // find ReAdmin_Session cookie
  const readminSession = cookie?.split(';').find(c => c.trim().startsWith('ReAdmin_Session='))?.split('=')[1] || '';

  const token = req.headers.auth as string || readminSession;
  const user = await checkJWT(token);
  // Behind a proxy the original host lives in x-forwarded-host (which may be a
  // comma separated list / repeated header - the first entry is the client's).
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim() ||
    req.headers.host ||
    null;
  return await createContextInner({
    user,
    host,
  });
}
