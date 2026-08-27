/**
 * verticals.ts — THE single source of truth for the four Apex verticals.
 *
 * Hard rule 3 (CLAUDE.md): four verticals, exact names, exact order. These strings
 * are an ENUM used as keys for routing, consent, and campaign defaults. Do not rename,
 * abbreviate, or reorder them anywhere. Nothing else in the codebase may hardcode a
 * vertical string — import `VERTICALS` / `Vertical` / `getVerticalConfig` from here.
 *
 * See docs/data-contract.md ("The `vertical` enum" and "Per-vertical config").
 */

/** The enum, in the exact order required by the data contract (D-02). */
export const VERTICALS = [
  'Designer Pools',
  'Concrete Coating',
  'Design & Renovation',
  'Pool Service',
] as const;

/** Union of the four exact enum strings. A lead with any other value is invalid. */
export type Vertical = (typeof VERTICALS)[number];

/** CSS custom-property name carrying each vertical's accent colour (see global.css). */
export type AccentVar = '--pool' | '--coat' | '--reno' | '--serv';

export interface VerticalConfig {
  /** The canonical enum string — also the key. Never derive this from anything else. */
  readonly vertical: Vertical;
  /**
   * URL slug for the vertical's section/route. Used for relative in-page anchors and,
   * later, vertical subfolders (/pools, /coating, ...). Kept relative — D-03 (canonical
   * domain) is BLOCKED, so no absolute paths depend on this.
   */
  readonly slug: string;
  /**
   * Brand name shown in the SMS consent disclosure for THIS vertical.
   * Hard rule 4 / D-06 / AC-3: legally load-bearing (TCPA). The consent line must name
   * the brand for the selected vertical — never a hardcoded one.
   */
  readonly consentBrand: string;
  /**
   * Fallback campaign when the visitor arrives with no `utm_campaign`.
   * data-contract.md: "Campaign here is only a fallback when no utm_campaign is present."
   */
  readonly defaultCampaign: string;
  /**
   * Reference only: which inbox n8n routes this vertical to. The SITE does not route —
   * it sends `vertical` and n8n owns the routing table (D-05). Kept here so the value
   * has one home; the site never POSTs this field.
   */
  readonly routedTo: string;
  /** The accent CSS variable for this vertical's colour-coding in the UI. */
  readonly accentVar: AccentVar;
}

/**
 * Per-vertical config. Keyed by the exact enum string. Object key order matches
 * VERTICALS order — do not reorder. Values come from docs/data-contract.md.
 */
export const VERTICAL_CONFIG: Readonly<Record<Vertical, VerticalConfig>> = {
  'Designer Pools': {
    vertical: 'Designer Pools',
    slug: 'pools',
    consentBrand: 'Apex Designer Pools',
    defaultCampaign: 'summer-pools-2026',
    routedTo: 'pools@apexgetsitdone.com',
    accentVar: '--pool',
  },
  'Concrete Coating': {
    vertical: 'Concrete Coating',
    slug: 'coating',
    consentBrand: 'Apex Concrete Coating',
    defaultCampaign: 'garage-floors-lbk',
    routedTo: 'coating@apexgetsitdone.com',
    accentVar: '--coat',
  },
  'Design & Renovation': {
    vertical: 'Design & Renovation',
    slug: 'renovation',
    consentBrand: 'Apex Design & Renovation',
    defaultCampaign: 'kitchen-reno-2026',
    routedTo: 'reno@apexgetsitdone.com',
    accentVar: '--reno',
  },
  'Pool Service': {
    vertical: 'Pool Service',
    slug: 'service',
    consentBrand: 'Apex Pool Service',
    defaultCampaign: 'service-signups',
    routedTo: 'service@apexgetsitdone.com',
    accentVar: '--serv',
  },
};

/** Ordered list of configs — the canonical iteration order for tiles, selectors, etc. */
export const VERTICAL_LIST: readonly VerticalConfig[] = VERTICALS.map(
  (v) => VERTICAL_CONFIG[v],
);

/** Type guard: is an arbitrary string one of the four exact enum values? */
export function isVertical(value: unknown): value is Vertical {
  return typeof value === 'string' && (VERTICALS as readonly string[]).includes(value);
}

/**
 * Look up a vertical's config, throwing on an unknown string. Use this instead of
 * indexing VERTICAL_CONFIG directly when the input isn't already typed as `Vertical`,
 * so an invalid vertical fails loud instead of silently producing `undefined`.
 */
export function getVerticalConfig(vertical: Vertical): VerticalConfig {
  const cfg = VERTICAL_CONFIG[vertical];
  if (!cfg) throw new Error(`Unknown vertical: ${JSON.stringify(vertical)}`);
  return cfg;
}
