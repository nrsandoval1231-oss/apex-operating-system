import type { CustomerPage } from '@apex/contracts';

/**
 * The customer progress page, rendered on the server — PRD §9.11.
 *
 * WHY THIS IS NOT A ROUTE IN THE APEX OS BUNDLE:
 *
 * This is the only surface a person outside Apex can reach, and it has no login.
 * Putting it inside the staff single-page app would ship every staff screen, the
 * pilot-token sign-in, and the `/api` client that carries a bearer token to a
 * homeowner's phone — none of which the page needs, and all of which would then
 * be one refactor away from being reachable from it. Rendered here, the page is
 * a string of HTML with no script at all: there is no client-side router to
 * navigate, no token in `sessionStorage`, and nothing to call an internal API
 * with. What the customer receives is exactly what the projection produced.
 *
 * The markup is deliberately plain. A homeowner opens this on a phone, often on
 * cellular, sometimes months apart. No fonts are fetched, no framework is
 * loaded, and the page works with JavaScript disabled because it does not use it.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape text for HTML.
 *
 * Applied to every interpolated value without exception, including ones that
 * "cannot" contain markup. Customer names and captions are typed by people, and
 * the day one of them contains an angle bracket must be a boring day.
 */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

/** 2026-07-31 → 31 July 2026. Dates on this page are read, not sorted. */
const readableDay = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  if (year === undefined || month === undefined || date === undefined) return day;
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date} ${months[month - 1] ?? ''} ${year}`.trim();
};

const MILESTONE_STATE_LABEL: Readonly<Record<string, string>> = {
  done: 'Complete',
  current: 'In progress',
  upcoming: 'Still to come',
};

const renderMilestones = (page: CustomerPage): string => `
    <ol class="track" aria-label="Your build">
${page.milestones.map((milestone) => `      <li class="step is-${milestone.state}">
        <span class="dot" aria-hidden="true"></span>
        <span class="step-title">${escapeHtml(milestone.title)}</span>
        <span class="step-state">${MILESTONE_STATE_LABEL[milestone.state] ?? ''}</span>
      </li>`).join('\n')}
    </ol>`;

const renderDecisions = (page: CustomerPage): string => {
  if (page.decisions.length === 0) return '';
  return `
    <section class="block block-ask" aria-labelledby="decisions">
      <h2 id="decisions">We need a decision from you</h2>
${page.decisions.map((decision) => `      <article class="ask">
        <h3>${escapeHtml(decision.title)}</h3>
        <p>${escapeHtml(decision.detail)}</p>
        <p class="consequence">${escapeHtml(decision.consequence)}</p>
${decision.neededBy === null ? '' : `        <p class="by">Needed by ${escapeHtml(readableDay(decision.neededBy))}</p>\n`}      </article>`).join('\n')}
      <p class="ask-how">Call or text us with your answer — we will record it and keep things moving.</p>
    </section>`;
};

const renderPhotos = (page: CustomerPage): string => {
  if (page.photos.length === 0) return '';
  return `
    <section class="block" aria-labelledby="photos">
      <h2 id="photos">Photos from your build</h2>
      <div class="gallery">
${page.photos.map((photo) => `        <figure>
          <img src="${escapeHtml(photo.href)}" alt="${escapeHtml(photo.caption ?? `Progress photo taken ${readableDay(photo.takenOn)}`)}" loading="lazy" decoding="async">
          <figcaption>
${photo.caption === null ? '' : `            <span class="caption">${escapeHtml(photo.caption)}</span>\n`}            <span class="when">${escapeHtml(readableDay(photo.takenOn))}</span>
          </figcaption>
        </figure>`).join('\n')}
      </div>
    </section>`;
};

const renderUpdates = (page: CustomerPage): string => {
  if (page.updates.length === 0) return '';
  return `
    <section class="block" aria-labelledby="updates">
      <h2 id="updates">What has happened so far</h2>
      <ol class="updates">
${page.updates.map((update) => `        <li>
          <time>${escapeHtml(readableDay(update.publishedOn))}</time>
          <h3>${escapeHtml(update.title)}</h3>
          <p>${escapeHtml(update.summary)}</p>
        </li>`).join('\n')}
      </ol>
    </section>`;
};

/**
 * The contact block.
 *
 * Omitted entirely when no number is configured. A page that prints a phone
 * number nobody set is worse than one that prints none, because a customer will
 * dial it and reach nobody at the moment they most wanted an answer.
 */
const renderContact = (page: CustomerPage): string => {
  if (page.contact === null) return '';
  const { phone, label } = page.contact;
  return `
    <section class="block block-contact" aria-labelledby="contact">
      <h2 id="contact">Questions?</h2>
      <p>${escapeHtml(label)}</p>
      <div class="contact-actions">
        <a class="btn" href="tel:${escapeHtml(phone)}">Call us</a>
        <a class="btn btn-ghost" href="sms:${escapeHtml(phone)}">Text us</a>
      </div>
    </section>`;
};

/** The whole page. Pure: the same projection always renders the same bytes. */
export function renderCustomerPage(page: CustomerPage): string {
  const who = page.customerName === null ? 'Your pool project' : `${page.customerName}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your pool — Apex Designer Pools</title>
<meta name="theme-color" content="#1b1c1e">
<!-- A shared link must never end up in a search index. The header sets this
     too; the tag covers a crawler that only reads markup. -->
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="/customer.css">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
<header class="masthead">
  <p class="brand">Apex Designer Pools</p>
  <h1>${escapeHtml(who)}</h1>
${page.addressLine === null ? '' : `  <p class="address">${escapeHtml(page.addressLine)}</p>\n`}</header>

<main>
  <section class="block block-status" aria-labelledby="status">
    <p class="eyebrow">Where things stand</p>
    <h2 id="status">${escapeHtml(page.headline)}</h2>
    <p>${escapeHtml(page.happeningNow)}</p>
${page.happeningNext === null ? '' : `    <p class="next">${escapeHtml(page.happeningNext)}</p>\n`}  </section>

  <section class="block" aria-labelledby="track">
    <h2 id="track">Your build</h2>
${renderMilestones(page)}
  </section>
${renderDecisions(page)}
${renderPhotos(page)}
${renderUpdates(page)}
${renderContact(page)}
</main>

<footer>
  <p>Apex Designer Pools — Lubbock, Texas</p>
  <p class="private">This page is private to you. Please do not share the link;
     ask us and we will send one of your own to whoever needs it.</p>
</footer>
</body>
</html>
`;
}

/**
 * What a revoked or unknown link gets.
 *
 * The two cases are deliberately indistinguishable. Telling a stranger that a
 * token used to be valid tells them the link scheme is real and worth guessing
 * at; telling the customer their link expired is the same sentence either way,
 * and the fix — call us — is the same too.
 */
export function renderClosedPage(contactPhone: string | null): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link not available — Apex Designer Pools</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="/customer.css">
</head>
<body>
<header class="masthead">
  <p class="brand">Apex Designer Pools</p>
  <h1>This link is no longer active</h1>
</header>
<main>
  <section class="block block-status">
    <p>The link you opened has expired or been replaced. Your project has not gone anywhere —
       only the link has.</p>
    <p>Get in touch and we will send you a new one.</p>
${contactPhone === null ? '' : `    <div class="contact-actions">
      <a class="btn" href="tel:${escapeHtml(contactPhone)}">Call us</a>
      <a class="btn btn-ghost" href="sms:${escapeHtml(contactPhone)}">Text us</a>
    </div>\n`}  </section>
</main>
<footer><p>Apex Designer Pools — Lubbock, Texas</p></footer>
</body>
</html>
`;
}
