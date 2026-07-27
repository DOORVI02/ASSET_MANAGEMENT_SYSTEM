/**
 * The single definition of the maintenance due-soon window.
 *
 * Confirmed 2026-07-26: maintenance is treated as due every 15 days. Dashboard counts,
 * the machine register, and machine detail must all derive their due state from here so
 * a count can never disagree with the list it drills into.
 */
export const DUE_SOON_WINDOW_DAYS = 15;

const MS_PER_DAY = 86_400_000;

/** Whole days from `now` until `date`. Negative once the date has passed. */
export function daysUntil(date: string, now: number = Date.now()): number {
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return Number.NaN;
  return (target - now) / MS_PER_DAY;
}

/** Due within the window and not yet past due. */
export function isDueSoon(date: string, now: number = Date.now()): boolean {
  const days = daysUntil(date, now);
  if (Number.isNaN(days)) return false;
  return days > 0 && days <= DUE_SOON_WINDOW_DAYS;
}

/** Past its due date. */
export function isOverdue(date: string, now: number = Date.now()): boolean {
  const days = daysUntil(date, now);
  if (Number.isNaN(days)) return false;
  return days < 0;
}
