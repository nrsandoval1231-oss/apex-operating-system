# Apex cinematic video handoff

**Status:** canonical hero delivery. D-23 supersedes D-22 (the scroll film).
**Recorded:** 2026-10-13

The approved family lifestyle master video is the only source of truth. Homepage V2 already
ships the page around it. This document is how that film enters the hero-media slot. It does
not replace the other six sections.

The homepage ships before the master arrives. It renders the V2 poster
(`v2-hero-poster` in `src/content/images.ts`) and no `<video>` element. That photograph is
licensed stock. It is not an Apex project and it is not the father-and-two-sons scene.

## Where it plays

`src/content/hero-media.ts` resolves the files below at build time. When the master exists,
`HERO_MEDIA.mode` becomes `playback` and `components/home/HeroMedia.astro` layers the film on
the same poster. When it does not, the mode stays `poster` and the markup contains no video
URL, so a production deployment cannot request media that was never delivered.

Desktop playback is muted, inline, and looping. The poster stays the LCP image. Mobile stays
on the poster until `apex-hero-family-mobile.mp4` exists. Data-saving, slow-2G/2G, reduced
motion, playback failure, and stalls also keep the poster.

The pause control is a sibling of `.hero-media`, in the hero's stacking context, above the
copy block. On desktop it sits in the open bottom-right corner. On a phone, where the CTAs
stretch full width, it sits in the open top-right corner. It is keyboard accessible.

## Drop-in asset contract

Put approved delivery files in `public/media/cinematic/`:

| File | Required | Use |
| --- | --- | --- |
| `apex-hero-family-master.mp4` | yes | 16:9 H.264, 1920×1080 minimum, 10–15 seconds, 24/30 fps |
| `apex-hero-family-master.webm` | optional | Smaller alternate browser encoding |
| `apex-hero-family-poster.webp` | recommended | Still extracted from the approved master, used as the video `poster` |
| `apex-hero-family-mobile.mp4` | optional | Lightweight portrait/mobile crop |
| `apex-hero-family-mobile-poster.webp` | optional | Mobile poster crop |

The visible still remains the V2 poster slot until that slot is replaced. Replacing it is a
content edit in `src/content/images.ts`: drop the file, clear `stock`, and rewrite the alt in
the same edit (D-20). Do not point the slot at a family still while the alt still describes
the stock dusk photograph.

## Approval brief

Create a 10–15 second premium West Texas custom-pool film: natural limestone and warm stucco,
a believable geometric pool with tanning ledge and subtle integrated spa, native drought-tolerant
landscaping, broad late-afternoon sky, and a father with his two sons. The central moment is the
three of them naturally jumping into the pool together. Keep the pool and home legible; no text,
logos, tropical resort elements, extra family members, exaggerated comedy action, distorted
anatomy, warped architecture, or visible AI artifacts.

Review the complete clip for identity continuity, faces and limbs, pool geometry, water physics,
copy readability, and loop seam before it is marked approved. No generated frame or still is
canonical on its own.

## Delivery and future extraction

Keep any high-resolution source outside the browser bundle. Encode delivery without audio and
with fast-start metadata. Target approximately 5 MB or less for desktop and 2 MB or less for
mobile after visual review. Posters and mobile crops, if produced, are derived deterministically
from that same approved master. Do not resume independent AI-frame generation, and do not build
the scroll-scrubbed canvas D-22 described. D-23 replaced that mechanism.

Example extraction, after approval, for a poster or a later derivative — not a scroll player:

```sh
mkdir -p frames
ffmpeg -i apex-hero-family-master.mp4 \
  -vf "select='not(mod(n,10))',scale=960:-2" -vsync vfr frames/frame-%04d.webp
```

No approved father-and-two-sons master was available when this contract was written. No family
video was generated or represented as approved. Supply the approved master under the contract
above and rebuild. The rest of Homepage V2 does not need to change.
