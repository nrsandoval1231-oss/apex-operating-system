# PRD 01 — Lead Capture, Funnel Architecture & Marketing Automation

**Status:** v0.1 draft, for Nick's sign-off
**Depends on:** `00-foundation.md` (Job ID as primary key)
**Client site:** apexgetsitdone.com — WordPress, built by Monsoon

---

## Decisions locked before this draft

| Decision | Implication |
|---|---|
| **Monsoon is replaced** | Nick owns the rebuild; no incumbent-agency coordination |
| **Pool Service becomes a fourth vertical** | Router, funnels, attribution, and CRM all change — see §2 |
| **Facebook is the live paid channel** | Attribution and the offline-conversion loop become the priority |
| **n8n is the automation layer** | Redirected from content generation to operations — see §5 |
| **Full redesign is the pitch** | Instrumentation still ships first, inside the redesign contract |

---

## 1. Problem

Three verticals route correctly at the top of the site, then converge into a single untagged intake:

- One contact form, **no service field**
- One phone number across all verticals
- One inbox (`travis@`), no routing, no SLA
- Consent text names **Apex Concrete Coating** on every submission, including pool inquiries
- Three cross-wired domains: site on `apexgetsitdone.com`, social image on `apexdesignandrenovation.com`, legal pages on `apexcoatinglbk.com`
- Zero pool testimonials; two pool photos; portfolio gallery repeats six images twice
- Lyon Financial (a pool-specific dealer account) buried as a footer logo

**Consequence:** conversion % and close rate by vertical — the explicit ask — cannot be computed, because the data is never captured. Facebook spend cannot be tied to won revenue. The leak is upstream of any CRM, so no CRM choice fixes it.

**Already in place and usable:** Google Tag Manager (GTM-WSHKQ3X) and Facebook domain verification. The plumbing exists; nothing flows through it.

---

## 2. The fourth vertical changes the model

Pool Service is currently buried as a bullet ("Weekly Maintenance & Cleaning") under Designer Pools. Promoting it is correct, and it breaks three assumptions in the other PRDs.

**It's recurring, so "cost per won job" stops working.** A pool build is one transaction. A service account at ~$150–200/month held for several years is worth several thousand in lifetime value. Acquisition budget has to be set against **LTV, not first-job value** — otherwise service looks like the cheapest vertical to acquire and gets starved.

**It's the cross-sell spine.** Every pool built should become a service account. Every service account is a standing prospect for coatings (pool decks), remodel, and eventually a re-plaster. This is the only vertical that produces *repeat contact* with a customer, which makes it the most valuable lead type in the business even though it's the smallest ticket.

**Its buyer journey is inverted.** Build, remodel, and coatings are considered purchases over weeks or months. Service is urgent and immediate — pump failed, water's green, pool's dirty before a party. Speed-to-lead matters more here than anywhere, and the funnel should be short: phone, not a quote form.

**Downstream effects to flag:** the "Which Apex" router goes to four tiles · commission structure for recurring revenue is undefined (out of scope here, belongs with PRD 04) · Foundation §2's "one Job = one contract" model doesn't fit a recurring service account and will need an amendment.

---

## 3. Success criteria

- Every lead carries **vertical + source + campaign + landing page**, automatically, with no human tagging
- **Cost per won job by vertical** — and **cost per acquired account, measured against LTV**, for service
- Speed-to-lead measured, with a target under 5 minutes
- Per-vertical conversion path and **legally correct per-vertical consent**
- One canonical domain; the other two 301'd
- Facebook receives **won-job values back**, not just lead events
- Baseline lead mix established before redesign layout decisions are locked

---

## 4. Scope

**In**
- Instrumentation: segmented form, hidden UTM/referrer/landing-page fields, GTM event layer, per-vertical tracking numbers, corrected consent, routed shared inbox with SLA timer
- Full site rebuild: IA for four verticals, per-vertical funnels, pool vertical rebuilt with real proof, service funnel built new
- Domain consolidation
- n8n automation layer (§5)
- Facebook measurement: Conversions API + offline conversion upload (§6)
- Google Business Profile and review engine (§7)

**Out**
- CRM platform selection (PRD 05)
- Commission engine, job costing, estimating (PRDs 02–04)
- Facebook ad *creative and budget strategy* — this PRD makes spend measurable, it doesn't manage it
- Recurring-revenue commission design

---

## 5. The n8n layer — redirected

**The push:** automating SEO *content generation* is aimed at the wrong lever, for two reasons.

**Reason one — the market is too thin to matter.** Lubbock metro is roughly 320k people. Local search volume for terms like "pool builder Lubbock" is in the low hundreds per month, and for concrete coating lower still. Winning organic there is worth having, but it's a small absolute number and it is not where a home-services business in a city this size gets its leads. The map pack and referrals are.

**Reason two — scaled AI content is an active liability.** Google's spam policies specifically target scaled content abuse: generating pages at volume primarily to manipulate rankings. Publishing dozens of automated posts against a handful of low-volume local terms takes real risk for a small ceiling.

**Where n8n is genuinely high-leverage instead** — same tool, same ambition, pointed at things that compound:

| Workflow | Why it matters |
|---|---|
| **Speed-to-lead auto-response + routing** | Biggest single conversion lever in home services; critical for the service vertical |
| **Review request engine** | Triggered on job completion, per vertical. Reviews drive the map pack — the actual ranking lever here |
| **Google Business Profile posting** | Scheduled posts and photo pushes from completed jobs |
| **Offline conversion upload to Meta** | §6 — the highest-value automation in this document |
| **Lead-to-CRM stitching** | Form + call + FB lead ad → one record with full attribution |
| **Attribution reporting** | Nightly roll-up: spend, leads, won jobs, cost per won job, by vertical |
| **Review and rank monitoring** | Alert on new reviews, ranking drops, site downtime, form failures |
| **Content *operations*** | Briefs, internal-link audits, technical monitoring — human writes, n8n handles the rest |

That last row is the compromise: automate the pipeline around content, keep a human on the words. For a business whose differentiator is a retired-firefighter owner with a 30-year warranty, the writing *is* the moat.

---

## 6. Facebook — the offline conversion loop

He's spending on Meta today and optimizing toward **form fills**, because that's all the pixel can see. Meta therefore optimizes for whoever fills out forms — which skews toward the cheapest, lowest-intent vertical.

Two changes:

1. **Conversions API (server-side).** Browser pixel loses a large share of events to iOS and ad blockers. n8n forwards events server-side.
2. **Offline conversion upload.** When a job is **won**, push the job value and vertical back to Meta against the original lead. Meta then optimizes toward *revenue*, not form volume.

This is the single highest-value automation here. It's also why PRD 01 depends on Foundation §2 — the loop only closes if the Job ID travels from ad click to won job and back.

**Consequence worth naming:** once revenue flows back, the algorithm will likely shift spend toward pools and away from coatings, purely on job value. That's correct on gross profit — but it will feel wrong to Travis if coatings currently produces his lead volume. Set expectations before switching it on.

---

## 7. SEO reality for a market this size

Priority order, highest leverage first:

1. **Google Business Profile** — the map pack is where local service clicks happen
2. **Review velocity** — the primary ranking factor in the map pack, and n8n-automatable
3. **Service-area and service pages** — one strong page per vertical per key term
4. **NAP consistency** across citations, currently at risk from the three-domain sprawl
5. **Content** — genuinely useful, human-written, low volume

**Open architecture question:** four verticals, four brands — one GBP or several? Separate listings can be legitimate for genuinely distinct businesses, but multiple listings sharing an address and phone risk suspension. Needs a real answer before the tracking numbers are assigned, since it interacts with §4.

**Domain recommendation:** consolidate to **one domain with strong subfolders** (`/pools/`, `/coatings/`, `/renovation/`, `/service/`). Splitting four brands across four domains divides authority four ways in a market that's thin to begin with. The "Which Apex" router already solves brand separation at the UX level — it doesn't need domain separation to work.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Redesign launches before lead-mix data exists | Ship instrumentation in week 1–2 of the build, not at launch |
| Replacing Monsoon leaves no one maintaining WordPress | Confirm hosting, domain registrar, and GTM/GA/Meta admin access **before** the relationship ends |
| Migration kills existing rankings | Full URL map and 301s; preserve GBP and citation NAP |
| Meta shifts spend away from the volume vertical | §6 — set expectations up front |
| Four verticals over-fragments a small site | Router already proven; keep vertical pages deep, not the top level wide |
| Automated content triggers a spam penalty | §5 — human-written words, automated operations |

---

## 9. Plan

| Phase | Work | Duration |
|---|---|---|
| **0** | Access audit — hosting, registrar, GTM, GA4, Meta Business, GBP ownership | 1 wk |
| **1** | Instrument the *existing* site: segmented form, UTM capture, GTM events, tracking numbers, consent fix, routed inbox | 2 wks |
| **2** | n8n: speed-to-lead, lead stitching, review engine | 2 wks |
| **3** | Measure — collect real lead mix and cost per vertical | 60 days, parallel |
| **4** | Redesign: IA, four funnels, pool rebuild, service funnel | 6–8 wks |
| **5** | Domain consolidation + migration | 1 wk |
| **6** | Meta CAPI + offline conversion loop | 2 wks |

Phases 3 and 4 overlap — design work proceeds while data accumulates, but **layout and funnel decisions lock against Phase 3 data, not assumptions.**

---

## 10. Open questions

1. **Access** — who holds the domain registrar, hosting, GTM, GA4, Meta Business Manager, and GBP? Blocks Phase 0 and is the highest-risk item in replacing Monsoon.
2. **Current Facebook spend** — monthly budget, campaign structure, which verticals, lead ads or site traffic?
3. **Current lead volume and mix** — even a rough sense.
4. **Who answers the phone**, and how fast? Determines whether speed-to-lead is a tooling problem or a staffing one.
5. **Revenue split across four verticals** — sets funnel priority.
6. **Pool service today** — how many accounts, what monthly rate, what retention? Needed to compute LTV and set acquisition budget.
7. **GBP structure** — one listing or several? (§7)
8. **Do the other two domains have live sites** on them, or are they parked?
9. **Redesign budget and timeline expectations.**
10. **Who writes the content?** Travis, Nick, or a hired writer — §5 assumes a human.
