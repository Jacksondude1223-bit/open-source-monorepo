/* eslint-disable @next/next/no-img-element */
import Head from 'next/head';
import Link from 'next/link';
import { ReactNode } from 'react';
import { useUser } from '~/components/contexts/user';

/** Canonical public host the postings pages are served from. */
export const POSTINGS_SITE_BASE = 'https://panel.readmin.app';

const DEFAULT_OG_IMAGE = 'https://cdn.readmin.app/readmin-public/RA-Black.png';

/** SEO metadata for a postings page. */
export type PostingsSeo = {
  /** Full <title>. Overrides the title-derived default when set. */
  title?: string;
  description?: string;
  /** Path (e.g. "/postings/123") — combined with the canonical host. */
  canonicalPath?: string;
  /** Absolute image URL for Open Graph / Twitter cards. */
  image?: string | null;
  /** When true, emits noindex/nofollow (closed or unlisted postings). */
  noindex?: boolean;
  /** Optional schema.org JSON-LD payload rendered as a script tag. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

type PostingsPublicLayoutProps = {
  children: ReactNode;
  title?: string;
  /** SEO metadata (description, canonical, Open Graph, JSON-LD). */
  seo?: PostingsSeo;
  /** Workspace-supplied logo URL — replaces the ReAdmin wordmark when set. */
  branding?: {
    logoUrl?: string | null;
    brandColor?: string | null;
    groupName?: string | null;
    /** Optional href the logo should link to (e.g. group postings page). */
    href?: string | null;
  };
};

const SAFE_BRAND_COLORS = new Set([
  'red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan',
  'blue', 'indigo', 'purple', 'rose', 'pink',
]);

/**
 * Lightweight public layout used by /postings, /postings/[groupId],
 * /postings/[groupId]/[jobId], and /resume/[username]. Does not require auth.
 */
export const PostingsPublicLayout = ({ children, title, seo, branding }: PostingsPublicLayoutProps) => {
  const user = useUser();
  const isLoggedIn = 'loggedIn' in user && user.loggedIn === true;

  const pageTitle = seo?.title || (title ? `${title} — ReAdmin Postings` : 'ReAdmin Postings');
  const description = seo?.description;
  const canonical = seo?.canonicalPath ? `${POSTINGS_SITE_BASE}${seo.canonicalPath}` : undefined;
  const ogImage = seo?.image || DEFAULT_OG_IMAGE;
  const robots = seo?.noindex ? 'noindex, nofollow' : 'index, follow';

  const brand = branding?.brandColor && SAFE_BRAND_COLORS.has(branding.brandColor)
    ? branding.brandColor
    : 'blue';
  const ctaClass = `bg-${brand}-600 hover:bg-${brand}-700 text-white px-3 py-1.5 rounded-md font-medium transition`;
  const customLogo = branding?.logoUrl || null;
  const headerHref = branding?.href || '/postings';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Head>
        <title>{pageTitle}</title>
        <link rel="icon" href={customLogo || 'https://cdn.readmin.app/readmin-public/RA-White.png'} />
        <meta name="robots" content={robots} />
        {description && <meta name="description" content={description} />}
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ReAdmin Postings" />
        <meta property="og:title" content={pageTitle} />
        {description && <meta property="og:description" content={description} />}
        {canonical && <meta property="og:url" content={canonical} />}
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        {description && <meta name="twitter:description" content={description} />}
        <meta name="twitter:image" content={ogImage} />
        {seo?.jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
          />
        )}
      </Head>
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={headerHref} className="flex items-center gap-2 hover:opacity-80 transition">
            {customLogo ? (
              <>
                <img
                  src={customLogo}
                  alt={branding?.groupName || ''}
                  className="h-9 w-9 rounded-md object-cover bg-gray-100 dark:bg-gray-800"
                />
                <span className="font-semibold text-lg tracking-tight truncate max-w-65">
                  {branding?.groupName || 'Postings'}
                </span>
              </>
            ) : (
              <>
                <img
                  src="https://cdn.readmin.app/readmin-public/RA-Black.png"
                  alt="ReAdmin"
                  className="h-7 w-auto block dark:hidden"
                />
                <img
                  src="https://cdn.readmin.app/readmin-public/RA-White.png"
                  alt="ReAdmin"
                  className="h-7 w-auto hidden dark:block"
                />
                <span className="font-semibold text-lg tracking-tight">Postings</span>
              </>
            )}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/postings" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
              Browse
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/dashboard/resume" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
                  My Resume
                </Link>
                <Link href="/dashboard/job-applications" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
                  My Applications
                </Link>
                <Link href="/dashboard" className={ctaClass}>
                  Dashboard
                </Link>
              </>
            ) : (
              <Link href="/login" className={ctaClass}>
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-500 dark:text-gray-400 text-center">
        Powered by ReAdmin
      </footer>
    </div>
  );
};
