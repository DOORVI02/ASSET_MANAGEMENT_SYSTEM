import { describe, expect, it } from 'vitest';
import { DUE_SOON_WINDOW_DAYS, daysUntil, isDueSoon, isOverdue } from './maintenance-window';

const now = new Date('2026-07-26T00:00:00.000Z').getTime();
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();

describe('maintenance due window', () => {
  it('uses a 15-day window', () => {
    expect(DUE_SOON_WINDOW_DAYS).toBe(15);
  });

  it('treats a date inside the window as due soon', () => {
    expect(isDueSoon(inDays(1), now)).toBe(true);
    expect(isDueSoon(inDays(14), now)).toBe(true);
    expect(isDueSoon(inDays(15), now)).toBe(true);
  });

  it('excludes dates beyond the window', () => {
    expect(isDueSoon(inDays(16), now)).toBe(false);
    expect(isDueSoon(inDays(30), now)).toBe(false);
  });

  it('does not count an already-passed date as due soon', () => {
    expect(isDueSoon(inDays(-1), now)).toBe(false);
    expect(isDueSoon(inDays(0), now)).toBe(false);
  });

  it('flags passed dates as overdue and future dates as not overdue', () => {
    expect(isOverdue(inDays(-1), now)).toBe(true);
    expect(isOverdue(inDays(1), now)).toBe(false);
  });

  it('never reports a date as both due soon and overdue', () => {
    for (const offset of [-30, -1, 0, 1, 15, 16, 90]) {
      expect(isDueSoon(inDays(offset), now) && isOverdue(inDays(offset), now)).toBe(false);
    }
  });

  it('returns NaN-safe results for unparseable dates', () => {
    expect(Number.isNaN(daysUntil('not a date', now))).toBe(true);
    expect(isDueSoon('not a date', now)).toBe(false);
    expect(isOverdue('', now)).toBe(false);
  });
});
