import { describe, expect, it } from 'vitest';
import { isOpenMaintenance, maintenanceDueState } from './maintenance-record';
import type { MaintenanceRecord } from './types';

const now = new Date('2026-07-26T00:00:00.000Z').getTime();
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();

function record(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'x1',
    machineId: 'm1',
    machineName: 'Test Machine',
    machineCode: 'TM-01',
    type: 'preventive',
    status: 'scheduled',
    scheduledDate: inDays(5),
    technicianId: 't1',
    technicianName: 'Test Tech',
    description: 'Test maintenance',
    createdAt: inDays(-1),
    updatedAt: inDays(-1),
    ...overrides,
  };
}

describe('isOpenMaintenance', () => {
  it('treats scheduled and in_progress as open', () => {
    expect(isOpenMaintenance(record({ status: 'scheduled' }))).toBe(true);
    expect(isOpenMaintenance(record({ status: 'in_progress' }))).toBe(true);
  });

  it('treats completed and cancelled as closed', () => {
    expect(isOpenMaintenance(record({ status: 'completed' }))).toBe(false);
    expect(isOpenMaintenance(record({ status: 'cancelled' }))).toBe(false);
  });
});

describe('maintenanceDueState', () => {
  it('is not_applicable for closed records regardless of scheduled date', () => {
    expect(
      maintenanceDueState(record({ status: 'completed', scheduledDate: inDays(-100) }), now),
    ).toBe('not_applicable');
    expect(
      maintenanceDueState(record({ status: 'cancelled', scheduledDate: inDays(-100) }), now),
    ).toBe('not_applicable');
  });

  it('is overdue for an open record whose date has passed', () => {
    expect(
      maintenanceDueState(record({ status: 'scheduled', scheduledDate: inDays(-1) }), now),
    ).toBe('overdue');
    expect(
      maintenanceDueState(record({ status: 'in_progress', scheduledDate: inDays(-10) }), now),
    ).toBe('overdue');
  });

  it('is due_soon inside the shared 15-day window', () => {
    expect(
      maintenanceDueState(record({ status: 'scheduled', scheduledDate: inDays(10) }), now),
    ).toBe('due_soon');
  });

  it('is ok well beyond the window', () => {
    expect(
      maintenanceDueState(record({ status: 'scheduled', scheduledDate: inDays(30) }), now),
    ).toBe('ok');
  });
});
