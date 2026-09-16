/**
 * sitemap.xml.ts — the sitemap, generated at build time (AC-5.4).
 *
 * Hand-rolled rather than pulled from @astrojs/sitemap on purpose. The page inventory is
 * small and fully derived from VERTICAL_LIST (via SITEMAP_ENTRIES in lib/seo.ts), and doing
 * it here keeps two properties that matter more than the convenience of an integration:
 *
 *   1. Every URL is built by `absoluteUrl()` from `PUBLIC_SITE_URL`, so the moment D-03 is
 *      decided the whole sitemap moves domain with one env change and no code edit.
 *   2. There is exactly ONE list of indexable pages in the repo, shared by the sitemap, the
 *      robots.txt reference, and the vertical routes. A page cannot exist and be missing
 *      from the sitemap, which is the usual way a migration quietly loses rankings.
 *
 * `lastmod` intentionally omitted: a build timestamp would claim every page changed on every
 * deploy, which trains crawlers to ignore the field. Add real per-page dates when content
 * moves to a CMS with modification tracking (D-07).
 *
 * TODO(BLOCKED: D-03): confirm the canonical domain — this file emits whatever
 * PUBLIC_SITE_URL says, and pointing it at the wrong domain during migration is how
 * duplicate-content problems start.
 */

import type { APIRoute } from 'astro';
import { absoluteUrl, SITEMAP_ENTRIES } from '@lib/seo';

export const GET: APIRoute = () => {
  const urls = SITEMAP_ENTRIES.map(
    (entry) =>
      `  <url>\n` +
      `    <loc>${absoluteUrl(entry.path)}</loc>\n` +
      `    <changefreq>${entry.changefreq}</changefreq>\n` +
      `    <priority>${entry.priority.toFixed(1)}</priority>\n` +
      `  </url>`,
  ).join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
