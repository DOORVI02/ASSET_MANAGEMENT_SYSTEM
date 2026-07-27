import { describe, expect, it } from 'vitest';
import { addInterval, formatInterval, planDueState, planNextDueDate } from './maintenance-plan';
import type { MaintenancePlan } from './types';

const now = new Date('2026-07-26T00:00:00.000Z').getTime();

function plan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: 'plan-x',
    machineId: 'm1',
    machineName: 'Test Machine',
    machineCode: 'TM-01',
    type: 'preventive',
    description: 'Test plan',
    intervalValue: 1,
    intervalUnit: 'months',
    isActive: true,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('addInterval', () => {
  it('adds days, weeks, months, and years without mutating the input', () => {
    const base = new Date('2026-01-15T00:00:00.000Z');

    expect(addInterval(base, 10, 'days').toISOString().slice(0, 10)).toBe('2026-01-25');
    expect(addInterval(base, 2, 'weeks').toISOString().slice(0, 10)).toBe('2026-01-29');
    expect(addInterval(base, 3, 'months').toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(addInterval(base, 1, 'years').toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(base.toISOString().slice(0, 10)).toBe('2026-01-15');
  });
});

describe('planNextDueDate', () => {
  it('adds the interval to the last completion date when one exists', () => {
    const due = planNextDueDate(
      plan({
        lastCompletedDate: '2026-06-01T00:00:00.000Z',
        intervalValue: 1,
        intervalUnit: 'months',
      }),
    );

    expect(due.slice(0, 10)).toBe('2026-07-01');
  });

  it('falls back to the creation date when never completed', () => {
    const due = planNextDueDate(
      plan({
        lastCompletedDate: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        intervalValue: 6,
        intervalUnit: 'months',
      }),
    );

    expect(due.slice(0, 10)).toBe('2026-07-01');
  });
});

describe('planDueState', () => {
  it('is not_applicable for an inactive or archived plan', () => {
    expect(planDueState(plan({ isActive: false }), now)).toBe('not_applicable');
    expect(planDueState(plan({ isArchived: true }), now)).toBe('not_applicable');
  });

  it('is overdue once the derived due date has passed', () => {
    expect(
      planDueState(
        plan({
          lastCompletedDate: '2026-01-01T00:00:00.000Z',
          intervalValue: 1,
          intervalUnit: 'months',
        }),
        now,
      ),
    ).toBe('overdue');
  });

  it('is due_soon within the shared window', () => {
    expect(
      planDueState(
        plan({
          lastCompletedDate: '2026-06-30T00:00:00.000Z',
          intervalValue: 1,
          intervalUnit: 'months',
        }),
        now,
      ),
    ).toBe('due_soon');
  });

  it('is ok well before the window', () => {
    expect(
      planDueState(
        plan({
          lastCompletedDate: '2026-07-20T00:00:00.000Z',
          intervalValue: 6,
          intervalUnit: 'months',
        }),
        now,
      ),
    ).toBe('ok');
  });
});

describe('formatInterval', () => {
  it('pluralizes correctly', () => {
    expect(formatInterval(1, 'months')).toBe('Every 1 month');
    expect(formatInterval(2, 'months')).toBe('Every 2 months');
    expect(formatInterval(1, 'days')).toBe('Every 1 day');
    expect(formatInterval(3, 'years')).toBe('Every 3 years');
  });
});
