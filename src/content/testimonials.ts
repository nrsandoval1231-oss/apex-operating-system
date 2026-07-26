/**
 * testimonials.ts — customer testimonials (content data, not inlined in components).
 * Copy verbatim from the approved mockup (D-08). Editable without touching layout.
 */

export interface Testimonial {
  /** 1–5; all current testimonials are 5-star. */
  readonly stars: number;
  readonly quote: string;
  /** Display name, e.g. "Bonnie T." */
  readonly name: string;
  /** Small descriptor under the name, e.g. "Homeowner · Renovation". */
  readonly context: string;
}

export const testimonials: readonly Testimonial[] = [
  {
    stars: 5,
    quote:
      'They rescued me when two previous contractors failed. They found every problem and made my house look and function beautifully. In, done, and completely finished. Kudos to Jorge and Frank.',
    name: 'Bonnie T.',
    context: 'Homeowner · Renovation',
  },
  {
    stars: 5,
    quote: 'They did our shop floor and it looks amazing. So nice and they do a great job.',
    name: 'Vickie S.',
    context: 'Homeowner · Coating',
  },
  {
    stars: 5,
    quote:
      'Travis and crew just got through doing two buildings for me. Very satisfied — cleaning up every day and good at what they do.',
    name: 'Bob M.',
    context: 'Homeowner · Coating',
  },
  {
    stars: 5,
    quote:
      'If you want a company that follows through and goes the extra mile, give them a call. Extremely happy with our porch.',
    name: 'Jeanie M.',
    context: 'Homeowner · Coating',
  },
  {
    stars: 5,
    quote:
      'Great work. Great people. Travis and his team do outstanding work. Highly recommend.',
    name: 'Terry W.',
    context: 'Homeowner',
  },
  {
    stars: 5,
    quote: "They did our garage last week and we couldn't be happier. We love it.",
    name: 'Laurie B.',
    context: 'Homeowner · Coating',
  },
];
