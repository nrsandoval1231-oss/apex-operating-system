# Cinematic delivery assets

The approved hero film is the owner-supplied master in this directory. It is a free,
watermark-free clip under the [Pexels License](https://www.pexels.com/license/). It is not an
Apex project and it is not the father-and-two-sons scene. Provenance is also recorded in
`config/stock-images.json` (`cinematic`).

| File | Role |
| --- | --- |
| `apex-hero-family-master.mp4` | Approved 1080p H.264 master, no audio, fast start |
| `apex-hero-family-master.webm` | Compressed VP9 alternate. Listed first in `<source>` |
| `apex-hero-family-mobile.mp4` | 720p H.264 for viewports at or below 720px, under 4 MB |
| `apex-hero-family-poster.webp` | Poster still supplied with the master |

The visible LCP image is the same still, at `public/images/v2/v2-hero-poster-*.jpg`. Reduced
motion, save-data, and slow networks stay on that still. Do not add experimental frames here.
See `../../../docs/cinematic-video-handoff.md` for the naming contract. D-23 superseded the
scroll-film plan.
