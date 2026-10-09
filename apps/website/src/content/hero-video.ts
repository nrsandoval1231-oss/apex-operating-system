import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The approved cinematic master is the only source of truth. Resolving the files while
 * building prevents a deployment from requesting media that has not been approved yet.
 */
const mediaRoot = join(process.cwd(), 'public', 'media', 'cinematic');
const file = (name: string) =>
  existsSync(join(mediaRoot, name)) ? `/media/cinematic/${name}` : null;

export const HERO_VIDEO = {
  master: file('apex-hero-family-master.mp4'),
  webm: file('apex-hero-family-master.webm'),
  mobile: file('apex-hero-family-mobile.mp4'),
  poster: file('apex-hero-family-poster.webp'),
  mobilePoster: file('apex-hero-family-mobile-poster.webp'),
} as const;

export const HERO_VIDEO_PENDING = !HERO_VIDEO.master;
