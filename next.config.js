/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
const { env } = require('./src/services/env');

/**
 * Don't be scared of the generics here.
 * All they do is to give us autocompletion when using this.
 *
 * @template {import('next').NextConfig} T
 * @param {T} config - A generic parameter that flows through to the return type
 * @constraint {{import('next').NextConfig}}
 */
function getConfig(config) {
  return config;
}

/**
 * The panel's Content-Security-Policy. A self-hosted deployment appends its own
 * panel / API / CDN hosts through CSP_EXTRA_DOMAINS (space separated), otherwise
 * the browser blocks its own assets and API calls.
 */
/**
 * `host:port` of a URL, as a CSP source.
 *
 * The port matters: a CSP host-source with no port only matches its scheme's
 * default port, so `1.2.3.4` does NOT allow `http://1.2.3.4:3001`. That is why
 * the built-in list below spells out `localhost:3001`. Dropping the port here
 * blocks every API call from a deployment served on a non-standard port.
 *
 * @param {string | undefined} url
 * @returns {string}
 */
function cspSource(url) {
  if (!url) return '';
  try {
    return new URL(url).host; // `host`, not `hostname` — keeps the port.
  } catch {
    return String(url).replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').replace(/\/.*$/, '');
  }
}

function contentSecurityPolicy() {
  // Derived from the deployment's own URLs rather than left to the operator to
  // remember: the panel loads from itself, calls the API cross-origin, and pulls
  // assets from wherever files are served. Getting any of these wrong shows up
  // as the browser blocking the app's own requests.
  const ownHosts = [
    cspSource(env.NEXT_PUBLIC_PANEL_URL),
    cspSource(env.NEXT_PUBLIC_API_URL),
    cspSource(env.CDN_URL),
  ];

  const sources = [
    "default-src 'self' 'unsafe-eval'",
    'readmin.app s3.amazonaws.com/cdn.readmin.app/ cdn.readmin.app localhost:3001',
    '*.readmin.dev *.readmin.app localhost *.readmin.app',
    '*.roblox.com *.robloxlabs.com *.rbxcdn.com',
    '*.discordapp.com *.discord.com rsms.me *.posthog.com',
    '*.googletagmanager.com *.google-analytics.com *.gstatic.com *.googleapis.com *.google',
    ...ownHosts,
    (env.CSP_EXTRA_DOMAINS || '').trim(),
    "'unsafe-inline' blob: data:",
  ];

  // Split on whitespace so CSP_EXTRA_DOMAINS' own entries dedupe against the
  // derived ones — otherwise every host appears twice.
  const seen = new Set();
  const parts = sources
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter((part) => {
      if (!part || seen.has(part)) return false;
      seen.add(part);
      return true;
    });

  return `${parts.join(' ')};`;
}

/**
 * @link https://nextjs.org/docs/api-reference/next.config.js/introduction
 */
module.exports = getConfig({
  /**
   * Dynamic configuration available for the browser and server.
   * Note: requires `ssr: true` or a `getInitialProps` in `_app.tsx`
   * @link https://nextjs.org/docs/api-reference/next.config.js/runtime-configuration
   */
  env: {
    NEXT_PUBLIC_VERCEL_ENV: env.NEXT_PUBLIC_VERCEL_ENV,
    APP_NAME: 'panel',
    CDN_URL: env.CDN_URL,
    VERCEL_URL: env.VERCEL_URL,
    NEXT_PUBLIC_VERCEL_URL: env.NEXT_PUBLIC_VERCEL_URL,
    VERCEL_GIT_COMMIT_SHA: env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_ENV: env.VERCEL_ENV,
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE: env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE,
    NEXT_PUBLIC_PANEL_URL: env.NEXT_PUBLIC_PANEL_URL,
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ROBLOX_CLIENT_ID: env.NEXT_PUBLIC_ROBLOX_CLIENT_ID,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy()
          }
        ],
      },
      // {
      //   // Content-hashed build assets are safe to cache forever — the filename
      //   // changes whenever the content does, so this never serves stale code.
      //   source: '/_next/static/:path*',
      //   headers: [
      //     {
      //       key: 'Cache-Control',
      //       value: 'public, max-age=31536000, immutable',
      //     },
      //   ],
      // },
      // {
      //   // Everything else (HTML documents and `_next/data` JSON) must always be
      //   // revalidated. Without this the browser heuristically caches the SPA
      //   // shell and stale data routes, so users only see updates after a hard
      //   // refresh. Excludes the immutable static assets handled above.
      //   source: '/((?!_next/static/|_next/image).*)',
      //   headers: [
      //     {
      //       key: 'Cache-Control',
      //       value: 'no-cache, no-store, max-age=0, must-revalidate',
      //     },
      //   ],
      // },
    ]
  },
  // deploymentId: env.VERCEL_GIT_COMMIT_SHA || 'dev',
  poweredByHeader: false,
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium'
  ],
  transpilePackages: [
    '@mui/x-data-grid',
  ]
});
// 7143