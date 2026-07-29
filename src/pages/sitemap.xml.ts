import type { GetServerSideProps } from 'next';
import { readminCollections } from '~/services/mongo.service';

/** Canonical public host the postings pages are served from. */
const SITE_BASE = 'https://panel.readmin.app';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
};

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  const base = host ? `${proto}://${host}` : SITE_BASE;

  const postings = await readminCollections.job_posting
    .find(
      {
        status: 'active',
        visibility: 'public',
        $or: [
          { opensAt: { $exists: false } },
          { opensAt: null },
          { opensAt: { $lte: new Date() } },
        ],
      },
      { projection: { groupId: 1, createdAt: 1, updatedAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(10000)
    .toArray();

  const urls: SitemapUrl[] = [
    { loc: `${base}/postings`, changefreq: 'daily', priority: '0.9' },
  ];

  const seenGroups = new Set<string>();
  for (const posting of postings) {
    const id = posting._id?.toString();
    if (!id) continue;
    if (!seenGroups.has(posting.groupId)) {
      seenGroups.add(posting.groupId);
      urls.push({
        loc: `${base}/postings/${posting.groupId}`,
        changefreq: 'weekly',
        priority: '0.6',
      });
    }
    urls.push({
      loc: `${base}/postings/${posting.groupId}/${id}`,
      lastmod: new Date(posting.updatedAt || posting.createdAt).toISOString(),
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();

  return { props: {} };
};

export default function SiteMap() {
  return null;
}
