/**
 * home-v2.ts — Homepage V2 copy.
 *
 * Same contract as the other content files (D-07/D-08): all homepage copy lives in `content/`,
 * never inlined in components, so it can be edited without touching layout and a headless CMS
 * can be layered on later. The home page renders from this module exclusively — the retired
 * site-copy hero/router entries were removed rather than left behind, because V2 is a different
 * narrative, not a restyle of the old one.
 *
 * THE NARRATIVE is the spine of the page and is deliberately fixed:
 *
 *   DESIRE → EMOTION → CRAFTSMANSHIP → PROOF → TRUST → CAPABILITY → CONVERSION
 *
 * Sections 01–07 below map onto that spine one-to-one. The order is not a preference: the
 * emotional promise is earned first and proven last, which is the inverse of a conventional
 * services page and is the whole reason the page can work with a static hero.
 *
 * TRUTHFULNESS: nothing in this file names a project, location, client, or job that Apex has
 * not documented. There is no real Apex photography yet (D-20), so every image on the page is a
 * licensed stock placeholder carried in the manifest. The copy is written to be true alongside
 * that — it describes what Apex builds and stands behind, never "a completed Apex pool in
 * Lubbock". See content/images.ts for the rule this shares with the image manifest.
 */

export interface ShowProject {
  /** Stable id — resolves to an image slot in content/images.ts. */
  readonly image: string;
  /**
   * Display label. Deliberately descriptive of the imagery rather than a job title: with no
   * documented projects, naming one would invent a fact. When real portfolio work arrives this
   * becomes the project name and `location` becomes the real location — a content-only change.
   */
  readonly label: string;
  /** Pool/environment type as shown. Same caveat as `label`. */
  readonly type: string;
  /** Integrated features, written as capabilities rather than as claims about a specific job. */
  readonly features: readonly string[];
}

export const heroV2 = {
  eyebrow: 'Lubbock & the South Plains',
  /** Rendered as two lines with the accent phrase, matching the old hero's typographic beat. */
  headingLines: ['Built for the moments', 'that matter.'] as const,
  sub: 'Custom pools and outdoor environments designed for West Texas living.',
  cta: 'Start Your Project',
  ctaHref: '#quote',
  /** Quiet secondary action — the phone number is a real conversion path on a considered purchase. */
  secondaryCta: 'Call',
} as const;

/** Section 02 — the "splash" transition, currently expressed as a two-world composition. */
export const craftV2 = {
  eyebrow: 'Craftsmanship',
  headingLines: ['Beauty above the surface.', 'Engineering beneath it.'] as const,
  lead:
    'What you see is the easy half. Every pool we build is specified for the part nobody photographs — the structure beneath the plaster, the plumbing behind the wall, the equipment that has to still run in ten years.',
  /** Detail slots, presented as a composition rather than an icon grid. */
  details: [
    { label: 'Tile & coping', note: 'Set by hand, aligned to the geometry of the shell.' },
    { label: 'Lighting', note: 'Positioned to read the water, not just illuminate it.' },
    { label: 'Depth transitions', note: 'Built so the floor changes gradually, the way a body expects.' },
    { label: 'Finish', note: 'The last surface anyone will ever see, so it gets the most attention.' },
  ] as const,
} as const;

/** Section 03 — architectural showcase. Editorial, one environment at a time. */
export const showcaseV2 = {
  eyebrow: 'The work',
  heading: 'Built to belong to the property.',
  lead:
    'A pool that fights the house reads as an addition. The ones that hold up were designed around the architecture from the first line.',
  projects: [
    {
      image: 'v2-showcase-1',
      label: 'Dusk environment',
      type: 'Custom pool with raised spa',
      features: ['Integrated spa', 'Water features', 'Architectural lighting'],
    },
    {
      image: 'v2-showcase-2',
      label: 'Backyard setting',
      type: 'Pool with outdoor living',
      features: ['Pergola', 'Outdoor kitchen', 'Landscape integration'],
    },
  ] as const,
} as const;

/** Section 04 — outdoor living. One cohesive place, not a list of disconnected features. */
export const livingV2 = {
  eyebrow: 'Outdoor living',
  headingLines: ["We don't build isolated features.", 'We build the place your family lives outside.'] as const,
  lead:
    'The pool is the centre. Everything around it — kitchen, shade, fire, planting — is designed against the same plan, so the backyard reads as one room rather than four contractors working next to each other.',
  elements: ['Pools', 'Spas', 'Outdoor kitchens', 'Pergolas', 'Fire features', 'Landscape integration'] as const,
} as const;

/** Section 05 — the Apex Standard. Craft and trust, stated plainly. */
export const standardV2 = {
  eyebrow: 'The Apex Standard',
  heading: 'Craftsmanship you can see — and engineering you can’t.',
  principles: [
    { title: 'Designed around your property.', body: 'Not dropped onto it. The pool is drawn to the house, the grade, and the way light moves across the yard.' },
    { title: 'Built for West Texas.', body: 'Our climate is hard on concrete and easy on shortcuts. We build for the heat, the sun, and the freeze-thaw cycle behind it.' },
    { title: 'Managed from concept through completion.', body: 'One team holds the thread from the first sketch to the final walkthrough. Nothing gets handed off into a gap.' },
    { title: 'Warrantied like we intend to be around.', body: 'Thirty years on coatings. Seven on pool builds. Forty-eight hours to respond. We would rather service a job than argue about it.' },
  ] as const,
} as const;

/**
 * Section 06 — capability across the four verticals.
 *
 * Deliberately NOT a four-card grid. The page is brand-first and pools-led, but the other three
 * verticals are real revenue and real pages that must stay reachable (hard rule 3), so they are
 * presented as a typographic index — the treatment an architectural publication would use for a
 * back-of-book contents page. Every entry links to its own landing page AND carries
 * `data-preselect` so the quote form opens on the right vertical, preserving the AC-2.2
 * contract that the old router tiles carried.
 */
export const capabilityV2 = {
  eyebrow: 'One brand, four specialties',
  heading: 'Deep capability, under one roof.',
  lead:
    'Pools carry the story here, but they are not the only thing we do well. Four crews, one standard — and every one of them is accountable to the same warranties.',
} as const;

/** Section 07 — process, then the emotional close and the conversion. */
export const closeV2 = {
  eyebrow: 'How it happens',
  heading: 'Four steps, one team.',
  process: [
    { n: '01', title: 'Imagine', body: 'What you want the backyard to feel like, before anyone draws a line.' },
    { n: '02', title: 'Design', body: 'Drawings, materials, and a real number — before you commit to anything.' },
    { n: '03', title: 'Build', body: 'One team, start to finish, on a schedule we tell you the truth about.' },
    { n: '04', title: 'Live', body: 'Handover, walkthrough, and a number to call that gets answered.' },
  ] as const,
  closeEyebrow: 'Ready when you are',
  closeHeading: 'Build the backyard they’ll remember.',
  closeLead:
    'Tell us what you are imagining and we will tell you honestly whether we are the right people to build it — including when the answer is no.',
  cta: 'Start Your Project',
} as const;
