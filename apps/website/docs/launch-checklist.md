# Launch Checklist — Apex Website

The cutover runbook. Ordered so that **nothing irreversible happens before the thing that makes it reversible**.

Everything in the repo is built. What remains is not code — it is access, one domain decision, and photography. Three of the steps below are `⚠ BLOCKED` and cannot be closed by an agent.

**Owner: Nick (maintainer). Client: Travis.**

---

## The three things that gate launch

| Gate | What it blocks | Why it can't be guessed |
|---|---|---|
| **D-01** access transfer from Monsoon | Everything after Step 2 | You cannot repoint DNS you don't control, and you cannot verify search impact through a Search Console you can't open. |
| **D-03** canonical domain | The redirect map, the sitemap, every absolute URL | Three domains are in play. Picking wrong and correcting later means migrating twice and losing equity twice. |
| **D-20** photography | Whether the site is *worth* launching, not whether it *can* | 13 image slots ship as labeled placeholders. Pools is the highest-ticket vertical and the least documented. |

D-01 and D-03 are hard blocks. D-20 is a judgement call — the site is launchable with placeholders (`npm run preflight -- --allow-placeholders`), it just converts worse, and the pools vertical is where that costs the most.

---

## Step 1 — Confirm access (⚠ BLOCKED: D-01)

Do this **first and completely**. Agencies commonly hold these in their own accounts, and discovering it mid-cutover means the site is down while you negotiate.

| Asset | What you need | Confirmed? |
|---|---|---|
| Domain registrar | Login, or transfer to an Apex-owned account | ☐ |
| DNS host | Ability to edit A/CNAME records | ☐ |
| Web hosting | Deploy access to the target environment | ☐ |
| GTM container (`GTM-WSHKQ3X`) | Admin, not just Edit | ☐ |
| GA4 property | Admin. Confirm it is a *property*, not a view on someone else's | ☐ |
| Meta Business Manager | Admin on the Business, plus the ad account and pixel | ☐ |
| Google Business Profile | **Primary owner**, not Manager | ☐ |
| Legacy domains | Registrar access to both `apexdesignandrenovation.com` and `apexcoatinglbk.com` | ☐ |

**Google Business Profile is the one to chase hardest.** It drives local pack visibility for every vertical, and recovering ownership from an unresponsive agency runs weeks through a manual Google process. It is also the slowest to notice missing, because the listing keeps working — right up until you need to change it.

While you're in there, settle **D-09**: one GBP or several? Multiple listings sharing an address and phone risk suspension. This interacts with the per-vertical tracking numbers (`PUBLIC_PHONE_*`) and with NAP consistency, so answer it before any citations go out.

---

## Step 2 — Decide the canonical domain (⚠ BLOCKED: D-03)

Pick one. The other two 301 in wholesale.

| Candidate | For | Against |
|---|---|---|
| `apexgetsitdone.com` | Matches the brand line and the mark; currently the live site, so it holds the existing equity | — |
| `apexdesignandrenovation.com` | Some social/image history | Names one vertical, so it fights the four-vertical positioning the whole site is built on |
| `apexcoatinglbk.com` | Hosts the legal pages today | Same problem, plus it is the narrowest name |

The repo's recommendation is `apexgetsitdone.com` with vertical subfolders (`/pools`, `/coating`, `/renovation`, `/service`) — which is what the build already produces. **But the choice is yours; it has brand implications the repo can't weigh.**

Once decided:

1. Set `canonicalDomain` in `config/redirects.json`.
2. Set `PUBLIC_SITE_URL` in the production `.env`.
3. Both must match. If they don't, the canonical tags and the sitemap disagree, which is a duplicate-content signal.

**Legal-page interaction:** `apexcoatinglbk.com` currently hosts the privacy policy and terms, and the footer links there (`PUBLIC_PRIVACY_URL` / `PUBLIC_TERMS_URL`). The redirect map wildcards that whole domain to `/coating`. If you do nothing, the privacy policy 301s into a sales page — and A2P 10DLC registration fails on a policy that doesn't resolve. Either exclude the legal paths from the wildcard, or rebuild the policies on the canonical domain and repoint the two env vars.

---

## Step 3 — Build the old-URL inventory

Cannot start until Step 1 (needs Search Console and GA4). Full method in [`redirect-map.md`](redirect-map.md) Step 1 — the union of a crawl, Search Console, GA4, and the old sitemap.

Fill `pages[]` in `config/redirects.json`, then:

```bash
npm run redirects:generate -- --strict
```

`--strict` refuses to generate while the canonical domain is null or the page list is empty. It also catches self-redirects, duplicate rules, non-301 statuses, and A→B→C chains.

---

## Step 4 — Production build

The env is the build. A build made with the wrong `PUBLIC_ENV` is not visibly different and is not shippable.

```bash
PUBLIC_ENV=production npm run build
```

Then, without exception:

```bash
npm run preflight
```

This is the gate. It fails the build if `robots.txt` says `Disallow: /`, if the output still points at the test webhook, or if image slots are unfilled. It warns — but does not fail — on a missing analytics container or `og:image`, because those are your call.

Add `-- --allow-placeholders` only if you have consciously decided to launch before D-20 photography.

---

## Step 5 — Staging verification

Deploy to a staging URL **before** touching DNS.

```bash
npm run redirects:verify -- --base https://STAGING-URL --skip-legacy
```

Then walk the manual list that no script can check:

- ☐ Submit a real lead from each of the four verticals. Confirm each arrives in n8n with the correct `vertical`, a unique `lead_id`, and the attribution set (AC-1).
- ☐ Confirm the consent text on each submission names the **matching** brand. A pool lead consenting to "Apex Concrete Coating" is the specific bug this rebuild exists to fix (AC-3.4).
- ☐ Land on `/pools` with `?utm_source=facebook&utm_medium=paid&utm_campaign=test` and confirm the payload carries it through (AC-1.4, AC-1.5).
- ☐ **AC-8.2:** open `/coating` in a real browser and confirm the form arrives with Concrete Coating pre-selected. *(This one is genuinely unverified — the headless preview pane cannot hydrate `client:visible` islands, so it has never been exercised end-to-end. A Playwright test is drafted in `acceptance-criteria.md`.)*
- ☐ Open the site on an actual phone. The maintainer and the client will both do this first.
- ☐ Confirm `lead_submit` reaches GTM Preview with `vertical` and `source` (AC-5.5).
- ☐ Click both footer legal links. They must return 200.
- ☐ Run Lighthouse mobile on the home page: Performance ≥ 90, SEO ≥ 95 (AC-5.1).

---

## Step 6 — Cutover

1. ☐ Lower the DNS TTL to 300s **at least 24h before** the change. Do this early or the rollback window is however long the old TTL was.
2. ☐ Take a full backup of the current WordPress site and database. Keep it regardless of how confident anyone is.
3. ☐ Deploy the production build.
4. ☐ Put the generated redirect file (`build/redirects/…`) in place for the target host.
5. ☐ Point DNS at the new host.
6. ☐ Configure the two legacy-domain wildcards at their registrars.
7. ☐ Restore the DNS TTL once verified.

**Keep the old hosting live for 30 days.** It is the only cheap way to repair a URL the inventory missed.

---

## Step 7 — Immediately after cutover

```bash
npm run redirects:verify -- --base https://CANONICAL-DOMAIN
```

- ☐ Fetch `https://CANONICAL/robots.txt` in a browser and read it with your own eyes. It must say `Allow: /`. **This is the highest-consequence mistake available at cutover** — a wrong robots.txt looks completely normal and silently removes the site from search.
- ☐ Submit one real lead on the live site and confirm it lands in n8n.
- ☐ Submit `sitemap.xml` in Search Console.
- ☐ File a Change of Address in Search Console if the canonical domain differs from the previously-indexed one.
- ☐ Confirm GA4 is receiving real-time traffic.
- ☐ Update the Google Business Profile website URL, and any citation that points at a legacy domain.
- ☐ Update the link in every ad account (Meta, Google) that points at an old URL. A paid click into a 301 chain wastes budget on latency.

---

## Step 8 — The following weeks

- ☐ **24h:** re-run `redirects:verify`. DNS propagates unevenly; a rule that worked at cutover can surface a failure once other resolvers catch up.
- ☐ **Week 1:** Search Console → Coverage. Investigate every new 404. Each one is a URL the inventory missed and a ranking bleeding out.
- ☐ **Week 2:** compare organic sessions against the pre-launch baseline. A dip is normal; a cliff is a redirect problem.
- ☐ **Week 4:** confirm the new URLs are indexed and the old ones have dropped out.
- ☐ **Day 30:** only now, decommission the old hosting.

---

## Rollback

If leads stop arriving or traffic collapses:

1. Point DNS back at the old host. This is why the TTL was lowered and the old host kept alive.
2. Leads are the emergency, not rankings — rankings survive a few days of churn, a lost lead is gone. If the form is the only broken thing, fix the webhook rather than rolling back the whole site.
3. Re-run `preflight` and `redirects:verify` against the restored state before diagnosing anything else.
