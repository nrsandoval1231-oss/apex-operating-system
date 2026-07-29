/**
 * site-copy.ts — global site copy (hero, guarantee band, section eyebrows/headings).
 *
 * D-08: copy comes from the approved mockup (reference/apex-mockup.html), not rewritten
 * from scratch. All copy lives in content/ data files (never inlined in components) so it
 * can be edited without touching layout, and a headless CMS can be layered on later (D-07).
 */

export const hero = {
  eyebrow: 'Lubbock & the South Plains · Est. by a retired firefighter',
  // Rendered as three lines; the last line is the brand-sage accent phrase.
  headingLines: ['Anything', 'Construction.'] as const,
  headingAccent: 'Apex gets it done.',
  sub: 'Four crews. One standard. Pools, coatings, renovations, and pool service — built by a team that shows up, finishes the job, and stands behind it for decades.',
  stats: [
    { value: '30-Yr', label: 'Coating warranty' },
    { value: '7-Yr', label: 'Pool warranty' },
    { value: '48-Hr', label: 'Warranty response' },
  ],
  routerQuestion: 'Which Apex do you need?',
} as const;

/** The dark guarantee band between the vertical sections and testimonials. */
export const guaranteeStats = [
  { value: '30-Yr', label: 'Concrete coating warranty' },
  { value: '7-Yr', label: 'Pool build warranty' },
  { value: '48-Hr', label: 'Warranty response, guaranteed' },
  { value: '#1', label: 'Warranty work over new jobs' },
] as const;

export const sections = {
  more: {
    eyebrow: 'The rest of the crew',
    heading: 'Three more ways Apex gets it done.',
  },
  proof: {
    eyebrow: "Don't just take our word for it",
    heading: 'What our customers say.',
  },
  quote: {
    eyebrow: 'Ready to get it done?',
    heading: 'Tell us which Apex you need.',
    lead: "Pick your service and we'll text you back in minutes, not days. One form, routed to the right crew.",
  },
} as const;

export const footer = {
  blurb:
    'Anything construction, done right the first time. Serving Lubbock and the South Plains.',
  verticalsLine: 'POOLS · COATING · RENOVATION · SERVICE',
  financing: 'Financing via Lyon Financial',
  copyright: '© Apex 2026 · All rights reserved',
  /**
   * Labels only. The DESTINATIONS come from env (PUBLIC_PRIVACY_URL / PUBLIC_TERMS_URL) —
   * see lib/site.ts. Phase 5 turned these from plain text into real links: the site collects
   * SMS consent, and carriers require a reachable privacy policy that names SMS before an
   * A2P 10DLC campaign is approved. The old text-only version satisfied nothing.
   */
  privacyLabel: 'Privacy Policy',
  termsLabel: 'Terms & Conditions',
} as const;
