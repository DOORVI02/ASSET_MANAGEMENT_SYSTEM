import { describe, expect, it } from 'vitest';
import { partLifeState, replacementDueDate } from './part-life';
import type { MachinePart } from './types';

const now = new Date('2026-07-26T00:00:00.000Z').getTime();

function part(overrides: Partial<MachinePart> = {}): MachinePart {
  return {
    id: 'x1',
    machineId: 'm1',
    machineName: 'Test Machine',
    machineCode: 'TM-01',
    partCode: 'TP-01',
    partName: 'Test Part',
    category: 'Bearings',
    quantity: 1,
    unit: 'pcs',
    positionOnMachine: 'Drive end',
    fittedDate: '2026-01-26',
    notes: '',
    isArchived: false,
    createdAt: '2026-01-26T00:00:00.000Z',
    updatedAt: '2026-01-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('part replacement due date', () => {
  it('adds the expected life in months to the fitted date', () => {
    const due = replacementDueDate(part({ fittedDate: '2026-01-26', expectedLifeMonths: 6 }));

    expect(due?.slice(0, 10)).toBe('2026-07-26');
  });

  it('returns null when no expected life is recorded', () => {
    expect(replacementDueDate(part({ expectedLifeMonths: undefined }))).toBeNull();
    expect(replacementDueDate(part({ expectedLifeMonths: 0 }))).toBeNull();
  });

  it('returns null for an unparseable fitted date', () => {
    expect(
      replacementDueDate(part({ fittedDate: 'not a date', expectedLifeMonths: 6 })),
    ).toBeNull();
  });
});

describe('part life state', () => {
  it('reports unknown when no expected life is set', () => {
    expect(partLifeState(part({ expectedLifeMonths: undefined }), now)).toBe('unknown');
  });

  it('reports overdue once the due date has passed', () => {
    // Fitted 12 months ago with a 6 month life.
    expect(partLifeState(part({ fittedDate: '2025-07-26', expectedLifeMonths: 6 }), now)).toBe(
      'overdue',
    );
  });

  it('reports due_soon inside the shared 15-day window', () => {
    // Due 2026-08-05, which is 10 days out.
    expect(partLifeState(part({ fittedDate: '2026-02-05', expectedLifeMonths: 6 }), now)).toBe(
      'due_soon',
    );
  });

  it('reports ok well before the window', () => {
    expect(partLifeState(part({ fittedDate: '2026-06-26', expectedLifeMonths: 12 }), now)).toBe(
      'ok',
    );
  });

  it('never reports two states for the same part', () => {
    const states = ['2024-01-01', '2026-02-05', '2026-07-01', '2026-06-26'].map((fittedDate) =>
      partLifeState(part({ fittedDate, expectedLifeMonths: 6 }), now),
    );

    expect(states.every((state) => ['ok', 'due_soon', 'overdue', 'unknown'].includes(state))).toBe(
      true,
    );
  });
});
