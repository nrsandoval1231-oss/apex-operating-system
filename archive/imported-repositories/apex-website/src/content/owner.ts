/**
 * owner.ts — the owner/founder section content. Copy verbatim from the approved
 * mockup (D-08). Content data, not inlined in the component.
 */

import type { ImageSlotId } from './images';

export const owner = {
  eyebrow: 'Meet the owner',
  name: 'Travis Bouffard',
  title: 'Retired Firefighter · Founder & CEO',
  bio: 'Travis spent his career showing up when it mattered most. He runs Apex the same way — honest quotes, crews that clean up every day, and warranty work that comes before the next new job. When Apex takes on your project, one person is accountable for finishing it right.',
  cta: 'Get a free quote',
  image: 'owner-portrait' as ImageSlotId,
} as const;
