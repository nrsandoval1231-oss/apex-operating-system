import type { CalendarEntry } from '@apex/contracts';

const TERMINAL_STATUS: Readonly<Record<CalendarEntry['taskType'], ReadonlySet<string>>> = {
  visit: new Set(['done', 'cancelled']),
  gate: new Set(['released']),
  inspection: new Set(['passed', 'waived']),
};

export const needsScheduling = (entry: CalendarEntry): boolean =>
  entry.startsOn === null && !TERMINAL_STATUS[entry.taskType].has(entry.status);

