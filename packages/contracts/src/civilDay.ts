/** Operational calendar for Apex. Lubbock staff work on Central time. */
export const APEX_TIME_ZONE = 'America/Chicago';

/**
 * The calendar day of `date` in America/Chicago, as `YYYY-MM-DD`.
 *
 * `Date#toISOString` is UTC. A request at 10pm in Lubbock is already the next
 * day in UTC, and "Today" would then be tomorrow.
 */
export const civilDay = (date: Date = new Date(), timeZone: string = APEX_TIME_ZONE): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
