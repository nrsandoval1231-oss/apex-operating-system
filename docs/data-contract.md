# Data Contract — the Lead Object

This is the spine. If this is wrong, nothing downstream can be measured. Every other part of the site exists to populate this object correctly.

## The lead object

The quote form POSTs exactly this JSON to `PUBLIC_LEAD_WEBHOOK_URL`:

```json
{
  "lead_id":      "apex_1721925123_a1b9",   // generated client-side at submit, unique, never reused
  "vertical":     "Designer Pools",          // enum — see below. REQUIRED. Never empty.
  "first_name":   "Jordan",
  "last_name":    "Whitaker",
  "email":        "jordan.w@email.com",
  "phone":        "8065550142",              // digits only, normalized
  "consent_sms":  true,                       // must reflect the per-vertical disclosure shown
  "consent_text": "I agree to receive text messages from Apex Designer Pools ...", // the exact string shown to the user
  "source":       "facebook",                 // from utm_source, else referrer-derived, else "direct"
  "medium":       "paid",                     // from utm_medium, else derived
  "campaign":     "summer-pools-2026",        // from utm_campaign, else ""
  "landing_page": "/pools",                   // first path the visitor landed on this session
  "referrer":     "https://l.facebook.com/",  // document.referrer at first touch
  "fbclid":       "IwAR3...",                 // captured if present in URL, else ""
  "gclid":        "",                         // captured if present in URL, else ""
  "page_submitted":"/",                        // path where the form was actually submitted
  "device":       "mobile",                    // mobile | tablet | desktop
  "submitted_at": "2026-07-25T14:32:11-05:00"  // ISO 8601 with TZ
}
```

## The `vertical` enum — exact strings

```
Designer Pools
Concrete Coating
Design & Renovation
Pool Service
```

Used as object keys for routing, consent, and campaign defaults. Do not alter casing or wording. A submission with any other value is invalid.

## Attribution capture rules

1. **Capture at first touch, persist for the session.** On first page load, read `utm_*`, `fbclid`, `gclid`, `document.referrer`, and the landing path. Store them (sessionStorage). If the visitor navigates before submitting, these must not be overwritten by later pageviews.
2. **Resolve `source`/`medium` in this priority:** explicit `utm_source`/`utm_medium` → else derive from referrer (facebook.com → `facebook`/`paid` if `fbclid` present else `referral`; google → `google`/`organic`; empty referrer → `direct`/`none`) → else `direct`/`none`.
3. **`vertical` is set by the visitor's action, not guessed:** the service selector in the form is the source of truth. If the visitor arrived via a vertical CTA (e.g. clicked "Start my pool quote"), pre-select that vertical but still let them change it. Never submit with the default silently if they interacted with the selector.
4. **`landing_page` is the first path, `page_submitted` is where they converted.** Both are needed — one measures which content pulls leads, the other measures where the form converts.

## Per-vertical config (drives consent, routing defaults, campaign fallback)

| vertical | consent brand name | default campaign | routed_to (n8n uses this) |
|---|---|---|---|
| Designer Pools | Apex Designer Pools | summer-pools-2026 | pools@ |
| Concrete Coating | Apex Concrete Coating | garage-floors-lbk | coating@ |
| Design & Renovation | Apex Design & Renovation | kitchen-reno-2026 | reno@ |
| Pool Service | Apex Pool Service | service-signups | service@ |

The site sends `vertical`; **n8n owns the routing table** (which inbox, which auto-response). Don't hardcode inbox routing in the site beyond passing the vertical. Campaign here is only a fallback when no `utm_campaign` is present.

## What the site does NOT do

- It does not write to the CRM. It hands off to n8n.
- It does not send the auto-response. n8n does.
- It does not push Meta offline conversions. That happens later in the pipeline, keyed on `lead_id` when the job is won.

The site's entire responsibility: **produce a complete, correctly-tagged lead object and hand it off.** That's the contract.
