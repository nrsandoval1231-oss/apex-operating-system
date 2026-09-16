/**
 * robots.txt.ts — generated at build time (AC-5.4).
 *
 * Generated rather than dropped in /public because it must do two environment-dependent
 * things a static file cannot:
 *
 *   1. Point at the sitemap on the CANONICAL domain, read from PUBLIC_SITE_URL (D-03).
 *   2. Disallow everything on non-production builds. A preview deploy that gets indexed
 *      competes with the real site for the exact keywords this project is trying to win —
 *      the same class of mistake as Hard rule 6, applied to crawlers instead of webhooks.
 */

import type { APIRoute } from 'astro';
import { absoluteUrl } from '@lib/seo';
import { isProduction } from '@lib/site';

export const GET: APIRoute = () => {
  const body = isProduction
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
        '',
      ].join('\n')
    : [
        '# Non-production build: indexing disabled so a preview cannot compete with the',
        '# live site in search. Set PUBLIC_ENV=production to allow crawling.',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
