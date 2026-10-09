# Apex cinematic video handoff

**Status:** canonical implementation direction. The approved family lifestyle master video is
the source of truth. This replaces the prior frame-sequence-first plan.

The homepage can ship safely before the master arrives: it renders the existing licensed stock
pool photograph as a static fallback. That photograph is not presented as an Apex project or as
the requested father-and-two-sons scene.

## Drop-in asset contract

Put approved delivery files in `public/media/cinematic/`:

| File | Required | Use |
| --- | --- | --- |
| `apex-hero-family-master.mp4` | yes | 16:9 H.264, 1920×1080 minimum, 10–15 seconds, 24/30 fps |
| `apex-hero-family-master.webm` | optional | Smaller alternate browser encoding |
| `apex-hero-family-poster.webp` | recommended | Desktop poster extracted from the approved master |
| `apex-hero-family-mobile.mp4` | optional | Lightweight portrait/mobile crop |
| `apex-hero-family-mobile-poster.webp` | optional | Mobile poster crop |

`src/content/hero-video.ts` resolves these files at build time. If the required master is
absent, the markup contains no video URL, so a production deployment cannot make a broken media
request. Desktop playback is muted, inline, and looping. Mobile remains on the poster until its
dedicated video exists; data-saving, slow-2G/2G, reduced-motion, playback failure, and stalls
also retain the poster. The motion control is keyboard accessible.

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
mobile after visual review. Once the master is approved, derive poster frames, mobile crops, and
any future scroll-controlled sequence deterministically from that same video. Do not resume
independent AI-frame generation.

Example extraction, after approval:

```sh
mkdir -p frames
ffmpeg -i apex-hero-family-master.mp4 \
  -vf "select='not(mod(n,10))',scale=960:-2" -vsync vfr frames/frame-%04d.webp
```

Generation was unavailable in the previous work session because the connected video services had
no usable generation entitlement or credits. No family video was generated or approved. Supply
the approved master under the contract above, rebuild, and redeploy.
