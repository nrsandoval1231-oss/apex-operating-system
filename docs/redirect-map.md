# Redirect Map — old site → new site

**Status: ⚠ BLOCKED on D-03 (canonical domain) and D-01 (access transfer).**
This document is the *plan* and the *format*. It cannot be finalised until the maintainer picks the canonical domain, and it cannot be **verified** until DNS/hosting access is transferred from Monsoon.

Covers AC-7.1 (every old URL maps to a new URL or an intentional 301) and AC-7.2 (the two legacy domains 301 to the canonical domain).

---

## Why this exists

The current site has been live long enough to hold real organic rankings. On cutover, every URL that ranks and is not redirected loses its equity permanently — it does not "come back" once Google recrawls. The rebuild is only a net win if the migration is lossless, and the migration is only lossless if this table is complete *before* DNS changes.

The new site is deliberately small (5 URLs). The old one is not. Most of the work here is inventory, not routing.

---

## Step 1 — Build the old-URL inventory (must happen before cutover)

**This has not been done and cannot be done from inside this repo.** It needs the live site and the analytics/console access that D-01 gates. Pull the union of these four sources — any one alone misses URLs:

| Source | What it catches | Access needed |
|---|---|---|
| Full crawl of `apexgetsitdone.com` (Screaming Frog or equivalent) | Everything currently linked | none |
| Google Search Console → Pages → all indexed URLs | Pages that rank but are no longer linked | GSC (D-01) |
| GA4 → Pages report, last 12 months, sorted by sessions | Pages with real traffic, incl. orphans | GA4 (D-01) |
| Existing WordPress sitemap(s) | What the old CMS believes exists | none |

Expect the union to be larger than the crawl alone. WordPress sites accumulate `?p=` permalinks, attachment pages, tag/category archives, and paginated URLs that no menu links to.

**Rule:** any old URL with impressions or inbound links in the last 12 months gets an explicit destination in the table below. Everything else may 301 to the closest vertical page — never to the home page in bulk, and never to a 404. A mass redirect to `/` is treated by Google as a soft 404 and throws the equity away just as effectively as deleting the page.

---

## Step 2 — The new URL inventory (this is final)

Generated from `src/lib/seo.ts` → `SITEMAP_ENTRIES`. If a vertical is ever added, this list grows automatically and so must the map.

| New URL | Page |
|---|---|
| `/` | Home — four-vertical router |
| `/pools` | Designer Pools |
| `/coating` | Concrete Coating |
| `/renovation` | Design & Renovation |
| `/service` | Pool Service |

Legal pages (Privacy Policy, Terms) are referenced in the footer but **do not yet exist as routes** — they currently live on `apexcoatinglbk.com`. They must either be rebuilt here or the footer links must point at their surviving location before launch, or the migration ships two dead links on every page.

---

## Step 3 — The map

`TODO(BLOCKED: D-03)` — replace `CANONICAL` below with the chosen domain once decided.

### 3a · Legacy domain consolidation (AC-7.2)

Both legacy domains 301 **wholesale** to the canonical domain. These are domain-level rules, configured at the registrar/host, not in this repo.

| From | To | Type |
|---|---|---|
| `apexdesignandrenovation.com/*` | `https://CANONICAL/renovation` | 301 |
| `apexcoatinglbk.com/*` | `https://CANONICAL/coating` | 301 |

Each legacy domain redirects to the **vertical it represents**, not to `/`. A visitor who typed `apexcoatinglbk.com` wants coating; sending them to a four-way router makes them choose something they already chose.

Exception: if either legacy domain has individually-ranking deep pages, those get their own rows in 3b before the wildcard applies. The wildcard is the fallback, applied last.

Also required, on the canonical domain itself:
- `http://` → `https://` (301)
- `www` → apex (or apex → `www`) — pick one and be consistent with the `PUBLIC_SITE_URL` in `.env`, or the canonical tags and the redirects will disagree.

### 3b · Page-level map

One row per old URL from Step 1. Left column verbatim including trailing slash; WordPress URLs usually have one and the new site's do not, so most rows change shape.

| Old URL | New URL | Type | Notes |
|---|---|---|---|
| `/` | `/` | — | no change |
| _(fill from Step 1 inventory)_ | | | |

Suggested destination logic for a WordPress inventory, to be confirmed against the real crawl:

- pool build / gallery / design pages → `/pools`
- garage floor / epoxy / polyaspartic / concrete pages → `/coating`
- kitchen / bath / addition / roofing / remodel pages → `/renovation`
- pool cleaning / repair / maintenance / weekly service pages → `/service`
- contact / quote / estimate / free-consultation pages → `/#quote`
- about / owner / team pages → `/#owner`
- blog posts → the vertical they are about, **unless** the post itself ranks, in which case it must be rebuilt rather than redirected. A redirect from a ranking article to a sales page is a soft 404.
- `/wp-content/uploads/*` images that appear in Google Images → keep the files reachable or redirect to their replacement; do not let them 404.

---

## Step 4 — Implementation, by host

The deploy target is not yet fixed (`CLAUDE.md`: Hostinger, or Vercel/Netlify). The map above is the source; the file below is generated from it. **Do not hand-maintain both.**

**Netlify / Hostinger static** — `public/_redirects`:

```
/old-path   /pools   301
```

**Vercel** — `vercel.json`:

```json
{ "redirects": [{ "source": "/old-path", "destination": "/pools", "permanent": true }] }
```

**Apache (Hostinger shared hosting)** — `.htaccess`:

```apache
Redirect 301 /old-path /pools
```

No redirect file is committed yet, deliberately: shipping one built against a guessed domain would create redirect loops the moment D-03 resolves differently.

---

## Step 5 — Verification (AC-7.1 / AC-7.2)

Before announcing cutover, and again 24h after:

1. Every URL in the Step 1 inventory returns **301 → 200**, in one hop. Two-hop chains (`http://old` → `https://old` → `https://new`) leak a measurable amount of equity and are avoidable by ordering the rules correctly.
2. No redirect returns 302. A temporary redirect tells Google to keep the old URL indexed.
3. No redirect lands on a 404 or another redirect.
4. `https://CANONICAL/sitemap.xml` returns the 5 new URLs and is submitted in Search Console.
5. `https://CANONICAL/robots.txt` says `Allow: /` — confirm the production build actually had `PUBLIC_ENV=production`, or the live site ships `Disallow: /` and disappears from search entirely. This is the single highest-consequence mistake available at cutover.
6. Both legacy domains resolve and redirect (AC-7.2).
7. Search Console → Change of Address, if the canonical domain differs from the currently-indexed one.

Keep the old server or hosting live for at least 30 days after cutover so the redirects can be repaired if something was missed.
