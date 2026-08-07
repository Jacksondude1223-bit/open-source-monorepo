import { httpBatchStreamLink, httpSubscriptionLink, loggerLink, splitLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { NextPageContext } from 'next';
import type { AppRouter } from '~/server/routers/_app';
import parseCookies from '~/utils/parseCookies';
import { ssrPrepass } from '@trpc/next/ssrPrepass'
import superjson from 'superjson';

export function getBaseUrl(forSite: boolean = true) {
  const isClient = typeof window !== 'undefined';
  const env: 'unknown' | 'production' | 'preview' | 'development' = (process.env
    .NEXT_PUBLIC_VERCEL_ENV || 'unknown') as any;
  // A self-hosted deployment names its own hostnames, which beat the readmin.app
  // defaults below whatever NEXT_PUBLIC_VERCEL_ENV says. Inlined at build time,
  // so these must be present when `next build` runs — install.sh handles that.
  const configured = forSite
    ? process.env.NEXT_PUBLIC_PANEL_URL
    : process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (forSite) {
    return {
      unknown: isClient ? window.location.origin : `http://localhost:${process.env.PORT ?? 3000}`,
      production: 'https://panel.readmin.app',
      // preview: `https://${process.env.VERCEL_ENV}`,
      development: 'https://panel.readmin.dev',
      preview: 'https://panel.readmin.dev',
    }[env];
  }
  return {
    unknown: `http://localhost:3001`,
    production: 'https://api.readmin.app',
    // preview: `https://${process.env.VERCEL_ENV}`,
    development: 'https://api.readmin.dev',
    preview: 'https://api.readmin.dev',
  }[env];
}
/**
 * Extend `NextPageContext` with meta data that can be picked up by `responseMeta()` when server-side rendering
 */
export interface SSRContext extends NextPageContext {
  /**
   * Set HTTP Status code
   * @example
   * const utils = trpc.useUtils();
   * if (utils.ssrContext) {
   *   utils.ssrContext.status = 404;
   * }
   */
  status?: number;
}

/**
 * A set of strongly-typed React hooks from your `AppRouter` type signature with `createReactQueryHooks`.
 * @link https://trpc.io/docs/react#3-create-trpc-hooks
 */
// The transformer property has moved to httpLink/httpBatchLink/wsLink

export const trpc = createTRPCNext<AppRouter, SSRContext>({
  //@ts-expect-error bruh
  config({ ctx }) {
    /**
     * If you want to use SSR, you need to use the server's full URL
     * @link https://trpc.io/docs/ssr
     */
    return {
      /**
       * @link https://trpc.io/docs/data-transformers
       */
      transformer: superjson,
      /**
       * @link https://trpc.io/docs/links
       */
      links: [
        // adds pretty logs to your console in development and logs errors in production
        loggerLink(),
        splitLink({
          condition: (op) => op.type === 'subscription',
          false: httpBatchStreamLink({
            url: `${getBaseUrl(false)}/trpc`,
            /**
             * Set custom request headers on every request from tRPC
             * @link https://trpc.io/docs/ssr
             */
            headers() {
              if (ctx?.req) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { connection: _connection, ...headers } = ctx.req.headers;
                const token = parseCookies(headers?.cookie || '')?.ReAdmin_Session || '';
                const toSend: any = {
                  ...headers,
                  'x-ssr': '1',
                  auth: token,
                };
                return toSend;
              }
              return {
                auth: typeof window !== undefined
                  ? window.localStorage.getItem('token') || ''
                  : '',
              };
            },
            transformer: superjson,
          }),
          true: httpSubscriptionLink({
            url: `${getBaseUrl(false)}/trpc`,
            transformer: superjson,
            eventSourceOptions() {
              return {
                withCredentials: true,
                headers: {
                  'x-ssr': '1',
                  auth: typeof window !== undefined
                    ? window.localStorage.getItem('token') || ''
                    : '',
                }
              };
            }
          })
        })
      ],
      /**
       * @link https://react-query.tanstack.com/reference/QueryClient
       */
      // queryClientConfig: { defaultOptions: { queries: { staleTime: 60 } } },
      queryClientConfig: {
        defaultOptions: {
          queries: {
            // Don't keep hammering the API when the failure is a client error
            // (bad request / unauthorized / not found / forbidden). These won't
            // succeed on retry, and retrying just makes failed pages (e.g. a
            // workspace that doesn't exist or you can't access) sit spinning for
            // several seconds before showing the error. Only retry transient
            // (5xx / network) failures, and cap them.
            retry: (failureCount, error: any) => {
              const httpStatus: number | undefined =
                error?.data?.httpStatus ?? error?.shape?.data?.httpStatus;
              if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      },
    };
  },
  /**
   * @link https://trpc.io/docs/ssr
   */
  ssr: false,
  // ssrPrepass: ssrPrepass,
  // /**
  //  * Set headers or status code when doing SSR
  //  */
  // responseMeta(opts) {
  //   const ctx = opts.ctx as SSRContext;

  //   if (ctx.status) {
  //     // If HTTP status set, propagate that
  //     return {
  //       status: ctx.status,
  //     };
  //   }

  //   const error = opts.clientErrors[0];
  //   if (error) {
  //     // Propagate http first error from API calls
  //     return {
  //       status: error.data?.httpStatus ?? 500,
  //     };
  //   }

  //   // for app caching with SSR see https://trpc.io/docs/caching
  //   return {};
  // },
});

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
