import { describe, expect, it } from 'vitest';
import { deriveNotifications } from './notifications';
import type { Machine, MaintenanceRecord, RepairRecord } from './types';

const dayMs = 24 * 60 * 60 * 1000;

function isoIn(days: number): string {
  return new Date(Date.now() + days * dayMs).toISOString().slice(0, 10);
}

function maintenance(overrides: Partial<MaintenanceRecord> & { id: string }): MaintenanceRecord {
  return {
    machineId: 'm1',
    machineName: 'Conveyor',
    machineCode: 'CV-01',
    type: 'preventive',
    status: 'scheduled',
    scheduledDate: isoIn(1),
    technicianId: 't1',
    technicianName: 'A. Tech',
    description: 'Belt inspection',
    createdAt: isoIn(-30),
    updatedAt: isoIn(-30),
    ...overrides,
  } as MaintenanceRecord;
}

function repair(overrides: Partial<RepairRecord> & { id: string }): RepairRecord {
  return {
    machineId: 'm1',
    machineName: 'Conveyor',
    machineCode: 'CV-01',
    status: 'reported',
    reportedDate: isoIn(-1),
    reportedBy: 'Supervisor',
    description: 'Drive motor overheating',
    createdAt: isoIn(-1),
    updatedAt: isoIn(-1),
    ...overrides,
  } as RepairRecord;
}

describe('deriveNotifications', () => {
  it('returns nothing when no record needs attention', () => {
    const far = maintenance({ id: 'mr1', scheduledDate: isoIn(400) });
    const closed = repair({ id: 'rr1', status: 'completed' });

    expect(deriveNotifications([], [far], [closed])).toEqual([]);
  });

  it('raises overdue and due-soon maintenance but ignores closed records', () => {
    const overdue = maintenance({ id: 'mr1', scheduledDate: isoIn(-5) });
    const dueSoon = maintenance({ id: 'mr2', scheduledDate: isoIn(3) });
    const completed = maintenance({
      id: 'mr3',
      scheduledDate: isoIn(-5),
      status: 'completed',
    });

    const result = deriveNotifications([], [overdue, dueSoon, completed], []);

    expect(result.map((n) => n.id)).toEqual([
      'maintenance-mr1:overdue',
      'maintenance-mr2:due_soon',
    ]);
    expect(result[0].tone).toBe('overdue');
    expect(result[1].tone).toBe('due_soon');
  });

  it('raises only open repairs', () => {
    const open = repair({ id: 'rr1', status: 'in_progress' });
    const waiting = repair({ id: 'rr2', status: 'waiting_for_parts' });
    const cancelled = repair({ id: 'rr3', status: 'cancelled' });

    const result = deriveNotifications([], [], [open, waiting, cancelled]);

    expect(result.map((n) => n.id)).toEqual([
      'repair-rr1:in_progress',
      'repair-rr2:waiting_for_parts',
    ]);
  });

  it('ranks overdue above open repairs, and repairs above due-soon', () => {
    const dueSoon = maintenance({ id: 'mr1', scheduledDate: isoIn(2) });
    const overdue = maintenance({ id: 'mr2', scheduledDate: isoIn(-2) });
    const open = repair({ id: 'rr1' });

    const result = deriveNotifications([], [dueSoon, overdue], [open]);

    expect(result.map((n) => n.tone)).toEqual(['overdue', 'repair', 'due_soon']);
  });

  it('links every notification to a registered detail route', () => {
    const overdue = maintenance({ id: 'mr1', scheduledDate: isoIn(-2) });
    const open = repair({ id: 'rr1' });

    const result = deriveNotifications([], [overdue], [open]);

    expect(result.find((n) => n.id === 'maintenance-mr1:overdue')?.href).toBe('/maintenance/mr1');
    expect(result.find((n) => n.id === 'repair-rr1:reported')?.href).toBe('/repairs/rr1');
  });

  it('raises a machine whose next maintenance is due, matching the dashboard KPI', () => {
    // Regression: notifications used to read only maintenance *records*, while the
    // dashboard counts machines by `nextMaintenanceDate`. A department could show
    // "Due soon 1" while the bell said nothing needed attention.
    const machine = {
      id: 'm1',
      code: 'SP3-SM-05',
      name: 'Sinter Machine 2 Drive',
      status: 'active',
      nextMaintenanceDate: isoIn(3),
    } as Machine;

    const result = deriveNotifications([machine], [], []);

    expect(result).toHaveLength(1);
    expect(result[0].tone).toBe('due_soon');
    expect(result[0].href).toBe('/machines/m1');
  });

  it('does not double-report a machine that already has an open maintenance record', () => {
    const machine = {
      id: 'm1',
      code: 'CV-01',
      name: 'Conveyor',
      status: 'active',
      nextMaintenanceDate: isoIn(-2),
    } as Machine;
    const record = maintenance({ id: 'mr1', machineId: 'm1', scheduledDate: isoIn(-2) });

    const result = deriveNotifications([machine], [record], []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('maintenance-mr1:overdue');
  });

  it('ignores retired machines', () => {
    const retired = {
      id: 'm9',
      code: 'OLD-1',
      name: 'Old press',
      status: 'retired',
      nextMaintenanceDate: isoIn(-30),
    } as Machine;

    expect(deriveNotifications([retired], [], [])).toEqual([]);
  });

  it('caps the list so the menu cannot grow without bound', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      maintenance({ id: `mr${index}`, scheduledDate: isoIn(-index - 1) }),
    );

    expect(deriveNotifications([], many, [])).toHaveLength(8);
    expect(deriveNotifications([], many, [], 3)).toHaveLength(3);
  });
});
