/**
 * seo.ts — Phase 4 SEO helpers: absolute URLs, the site's page inventory, and JSON-LD
 * structured-data builders.
 *
 * Two rules govern this file:
 *
 *  1. **No absolute URL is ever hardcoded.** Every one is derived from `site.url`
 *     (env `PUBLIC_SITE_URL`), because the canonical domain is BLOCKED on D-03 and must be
 *     swappable with one env change — no code edit, no find-and-replace.
 *     TODO(BLOCKED: D-03): confirm the canonical domain before launch.
 *
 *  2. **Nothing is invented.** Structured data is a public claim about a real business.
 *     Apex's street address, geo coordinates, opening hours, and review aggregate are not
 *     established in this repo, and a wrong postal address actively damages the Google
 *     Business Profile / NAP consistency the launch checklist depends on (D-09). So the
 *     LocalBusiness node ships with only what is known — name, phone, email, areaServed —
 *     and the address is left as a documented gap.
 *     TODO(BLOCKED: D-09): supply the verified NAP address (and GBP structure) to complete
 *     the LocalBusiness node.
 */

import { site } from './site';
import { VERTICAL_LIST, type Vertical } from '@content/verticals';

/** Legal/display name of the business, used consistently across every schema node. */
export const ORG_NAME = 'Apex';
/** Full brand line as it appears in the mark. */
export const ORG_BRAND = 'Apex — Gets It Done';

/** The service area. Structured data uses these; they are also the local-SEO surface. */
export const SERVICE_AREA = [
  'Lubbock, TX',
  'Wolfforth, TX',
  'Shallowater, TX',
  'Idalou, TX',
  'Slaton, TX',
  'Levelland, TX',
  'Ransom Canyon, TX',
  'The South Plains',
] as const;

/**
 * Build an absolute URL from a site-relative path. Trailing-slash-insensitive on input;
 * output has no trailing slash except the root, so canonical tags and the sitemap agree.
 */
export function absoluteUrl(path = '/'): string {
  const base = site.url.replace(/\/+$/, '');
  const p = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  return `${base}${p}`;
}

/** A page in the sitemap. `changefreq`/`priority` are hints, not promises. */
export interface SitemapEntry {
  readonly path: string;
  readonly changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  readonly priority: number;
}

/**
 * The site's indexable page inventory — the single source for sitemap.xml and for the
 * breadcrumb/JSON-LD nodes. Derived from VERTICAL_LIST so a new vertical can never be added
 * to the enum and silently omitted from the sitemap.
 */
export const SITEMAP_ENTRIES: readonly SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  ...VERTICAL_LIST.map((cfg) => ({
    path: `/${cfg.slug}`,
    changefreq: 'monthly' as const,
    // Designer Pools is the highest-ticket vertical and the primary organic target.
    priority: cfg.vertical === 'Designer Pools' ? 0.9 : 0.8,
  })),
];

/* ------------------------------------------------------------------ JSON-LD builders */

/** A JSON-LD node. Loosely typed on purpose — schema.org shapes vary per type. */
export type JsonLdNode = Record<string, unknown>;

/**
 * The Organization / LocalBusiness node. Emitted once, on the home page only, so there is
 * exactly one authoritative business entity in the graph; other pages reference it by @id.
 */
export function organizationSchema(): JsonLdNode {
  return {
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${absoluteUrl('/')}#business`,
    name: ORG_NAME,
    alternateName: ORG_BRAND,
    url: absoluteUrl('/'),
    telephone: site.phoneE164,
    email: site.contactEmail,
    description:
      'Apex builds pools, installs concrete coatings, renovates homes, and services pools ' +
      'across Lubbock and the South Plains — four crews under one accountable contractor.',
    // TODO(BLOCKED: D-09): add `address` (PostalAddress) + `geo` once the verified NAP is
    // confirmed. Publishing an unverified address here would conflict with the GBP listing.
    areaServed: SERVICE_AREA.map((name) => ({ '@type': 'Place', name })),
    knowsAbout: VERTICAL_LIST.map((cfg) => cfg.vertical),
  };
}

/** The WebSite node — pairs with the Organization node on the home page. */
export function websiteSchema(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    url: absoluteUrl('/'),
    name: ORG_BRAND,
    publisher: { '@id': `${absoluteUrl('/')}#business` },
  };
}

/**
 * A Service node for one vertical. `serviceType` uses the EXACT enum string (Hard rule 3 /
 * AC-2.4) so the structured data and the lead payload describe the same thing.
 */
export function serviceSchema(vertical: Vertical, description: string, path: string): JsonLdNode {
  return {
    '@type': 'Service',
    '@id': `${absoluteUrl(path)}#service`,
    serviceType: vertical,
    name: `${vertical} — Lubbock, TX`,
    description,
    provider: { '@id': `${absoluteUrl('/')}#business` },
    areaServed: SERVICE_AREA.map((name) => ({ '@type': 'Place', name })),
    url: absoluteUrl(path),
  };
}

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

/** FAQPage node. Only emit this when the same Q&A is visible on the page — Google requires it. */
export function faqSchema(items: readonly FaqItem[], path: string): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(path)}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** BreadcrumbList for a second-level page. */
export function breadcrumbSchema(label: string, path: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: label, item: absoluteUrl(path) },
    ],
  };
}

/** Wrap nodes into a single @graph document — one <script> tag per page, not five. */
export function jsonLdGraph(nodes: readonly JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
