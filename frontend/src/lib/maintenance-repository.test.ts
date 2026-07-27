import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { AccessScope, MaintenancePlanInput, MaintenanceRecordInput } from './types';

/** Officer-like: Plate Mill plus Coal Handling, archived visible. */
const officer: AccessScope = { departmentIds: ['d15', 'd3'], includeArchived: true };
/** Supervisor-like: Coal Handling only, archived hidden. */
const supervisor: AccessScope = { departmentIds: ['d3'], includeArchived: false };

function recordInput(overrides: Partial<MaintenanceRecordInput> = {}): MaintenanceRecordInput {
  return {
    machineId: 'm1',
    type: 'preventive',
    scheduledDate: '2026-08-01',
    technicianId: 't1',
    technicianName: 'R. Kumar',
    description: 'Test maintenance record.',
    ...overrides,
  };
}

function planInput(overrides: Partial<MaintenancePlanInput> = {}): MaintenancePlanInput {
  return {
    machineId: 'm1',
    type: 'preventive',
    description: 'Test plan.',
    intervalValue: 1,
    intervalUnit: 'months',
    isActive: true,
    ...overrides,
  };
}

describe('maintenance record repository', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  describe('createMaintenanceRecord', () => {
    it('creates a scheduled record and denormalizes the machine', () => {
      const result = repository.createMaintenanceRecord(recordInput(), 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toMatchObject({ status: 'scheduled', machineCode: 'HP-04' });
      expect(repository.listAuditLogsForEntity(result.data.id)[0]).toMatchObject({
        action: 'maintenance_scheduled',
        entityType: 'maintenance',
      });
    });

    it('rejects an unknown machine', () => {
      expect(
        repository.createMaintenanceRecord(recordInput({ machineId: 'nope' }), 'u1'),
      ).toMatchObject({ ok: false, reason: 'unknown_machine' });
    });

    it('refuses to log maintenance on an archived machine', () => {
      expect(
        repository.createMaintenanceRecord(recordInput({ machineId: 'm15' }), 'u1'),
      ).toMatchObject({ ok: false, reason: 'already_archived' });
    });

    it('does not change the machine status merely by scheduling', () => {
      const before = repository.getMachine('m1');
      repository.createMaintenanceRecord(recordInput(), 'u1');

      expect(repository.getMachine('m1')?.status).toBe(before?.status);
    });
  });

  describe('status transitions: linear plus reopen', () => {
    it('starts a scheduled record and sets the machine under_maintenance', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = repository.startMaintenanceRecord(created.data.id, 'u1');

      expect(result).toMatchObject({ ok: true, data: { status: 'in_progress' } });
      expect(repository.getMachine('m1')?.status).toBe('under_maintenance');
    });

    it('refuses to start a record that is not scheduled', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.startMaintenanceRecord(created.data.id, 'u1');

      expect(repository.startMaintenanceRecord(created.data.id, 'u1')).toMatchObject({
        ok: false,
        reason: 'invalid_state',
      });
    });

    it('completes directly from scheduled without requiring start first', () => {
      // m3 has no other open maintenance in fixtures, unlike m1 (mr1 is scheduled).
      const created = repository.createMaintenanceRecord(recordInput({ machineId: 'm3' }), 'u1');
      if (!created.ok) return;

      const result = repository.completeMaintenanceRecord(created.data.id, 'u1', {
        actions: 'Done',
      });

      expect(result).toMatchObject({ ok: true, data: { status: 'completed' } });
      expect(repository.getMachine('m3')?.status).toBe('active');
    });

    it('completes from in_progress and records details', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.startMaintenanceRecord(created.data.id, 'u1');

      const result = repository.completeMaintenanceRecord(created.data.id, 'u1', {
        actions: 'Replaced filter',
        findings: 'Minor wear',
        durationHours: 3,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toMatchObject({
        status: 'completed',
        actions: 'Replaced filter',
        findings: 'Minor wear',
        durationHours: 3,
      });
      expect(result.data.completedDate).toBeDefined();
    });

    it('updates the machine lastMaintenanceDate on completion', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      const before = repository.getMachine('m1')?.lastMaintenanceDate;

      repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Done' });

      expect(repository.getMachine('m1')?.lastMaintenanceDate).not.toBe(before);
    });

    it('refuses to complete a closed record', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Done' });

      expect(
        repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Again' }),
      ).toMatchObject({ ok: false, reason: 'invalid_state' });
    });

    it('cancels a scheduled or in-progress record and records the reason', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;

      const result = repository.cancelMaintenanceRecord(created.data.id, 'u1', 'No longer needed');

      expect(result).toMatchObject({
        ok: true,
        data: { status: 'cancelled', remarks: 'No longer needed' },
      });
    });

    it('refuses to cancel an already-closed record', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.cancelMaintenanceRecord(created.data.id, 'u1');

      expect(repository.cancelMaintenanceRecord(created.data.id, 'u1')).toMatchObject({
        ok: false,
        reason: 'invalid_state',
      });
    });

    it('reopens a completed record back to in_progress and clears completedDate', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Done' });

      const result = repository.reopenMaintenanceRecord(created.data.id, 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe('in_progress');
      expect(result.data.completedDate).toBeUndefined();
      expect(repository.getMachine('m1')?.status).toBe('under_maintenance');
    });

    it('refuses to reopen a record that is not completed', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;

      expect(repository.reopenMaintenanceRecord(created.data.id, 'u1')).toMatchObject({
        ok: false,
        reason: 'invalid_state',
      });
    });

    it('audits start, complete, cancel, and reopen as distinct actions', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.startMaintenanceRecord(created.data.id, 'u1');
      repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Done' });
      repository.reopenMaintenanceRecord(created.data.id, 'u1');

      const actions = repository.listAuditLogsForEntity(created.data.id).map((log) => log.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'maintenance_scheduled',
          'maintenance_started',
          'maintenance_completed',
          'maintenance_reopened',
        ]),
      );
    });
  });

  describe('effective machine status precedence', () => {
    it('keeps the machine under_repair even after its maintenance completes, when a repair is open', () => {
      // m6 (CD-11) has an open repair (rr1) in the fixtures.
      const created = repository.createMaintenanceRecord(recordInput({ machineId: 'm6' }), 'u1');
      if (!created.ok) return;
      repository.startMaintenanceRecord(created.data.id, 'u1');
      expect(repository.getMachine('m6')?.status).toBe('under_repair');

      repository.completeMaintenanceRecord(created.data.id, 'u1', { actions: 'Done' });

      expect(repository.getMachine('m6')?.status).toBe('under_repair');
    });

    it('keeps the machine under_maintenance while any other maintenance record is still open', () => {
      const first = repository.createMaintenanceRecord(recordInput({ machineId: 'm3' }), 'u1');
      const second = repository.createMaintenanceRecord(recordInput({ machineId: 'm3' }), 'u1');
      if (!first.ok || !second.ok) return;

      repository.startMaintenanceRecord(first.data.id, 'u1');
      repository.startMaintenanceRecord(second.data.id, 'u1');
      repository.completeMaintenanceRecord(first.data.id, 'u1', { actions: 'Done' });

      expect(repository.getMachine('m3')?.status).toBe('under_maintenance');

      repository.completeMaintenanceRecord(second.data.id, 'u1', { actions: 'Done' });
      expect(repository.getMachine('m3')?.status).toBe('active');
    });

    it('cancelling the last open record also returns the machine to active', () => {
      const created = repository.createMaintenanceRecord(recordInput({ machineId: 'm3' }), 'u1');
      if (!created.ok) return;
      repository.startMaintenanceRecord(created.data.id, 'u1');

      repository.cancelMaintenanceRecord(created.data.id, 'u1');

      expect(repository.getMachine('m3')?.status).toBe('active');
    });
  });

  describe('updateMaintenanceRecord', () => {
    it('applies changes to an open record', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;

      const result = repository.updateMaintenanceRecord(
        created.data.id,
        recordInput({ description: 'Updated description' }),
        'u1',
      );

      expect(result).toMatchObject({ ok: true, data: { description: 'Updated description' } });
    });

    it('refuses to edit a closed record', () => {
      const created = repository.createMaintenanceRecord(recordInput(), 'u1');
      if (!created.ok) return;
      repository.cancelMaintenanceRecord(created.data.id, 'u1');

      expect(
        repository.updateMaintenanceRecord(created.data.id, recordInput(), 'u1'),
      ).toMatchObject({ ok: false, reason: 'invalid_state' });
    });
  });

  describe('department scoping', () => {
    it('returns only maintenance for machines in scope', () => {
      const allowed = new Set(repository.listMachinesInScope(supervisor).map((m) => m.id));
      const records = repository.listMaintenanceForDepartment('d3', supervisor);

      expect(records.every((r) => allowed.has(r.machineId))).toBe(true);
    });

    it('refuses a record outside the caller scope', () => {
      // mr1 belongs to m1 (HP-04) in Plate Mill, outside the supervisor's Coal Handling scope.
      expect(repository.getMaintenanceRecordInScope('mr1', supervisor)).toBeUndefined();
      expect(repository.getMaintenanceRecordInScope('mr1', officer)).toBeDefined();
    });

    it('scopes plans the same way records are scoped', () => {
      expect(repository.listMaintenancePlansForDepartment('d15', supervisor)).toEqual([]);
      expect(repository.listMaintenancePlansForDepartment('d15', officer).length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('maintenance summary', () => {
    it('counts by status and matches the due-state helpers', () => {
      const summary = repository.getMaintenanceSummary('d15', officer);
      const records = repository.listMaintenanceForDepartment('d15', officer);

      expect(summary.scheduled + summary.inProgress + summary.completed + summary.cancelled).toBe(
        records.length,
      );
    });

    it('returns zeroes for a department outside the scope', () => {
      expect(repository.getMaintenanceSummary('d15', supervisor)).toMatchObject({
        scheduled: 0,
        inProgress: 0,
        overdue: 0,
      });
    });
  });
});

describe('maintenance plan repository', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  it('creates a plan and denormalizes the machine', () => {
    const result = repository.createMaintenancePlan(planInput(), 'u1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ machineCode: 'HP-04', isActive: true, isArchived: false });
  });

  it('rejects an unknown machine', () => {
    expect(repository.createMaintenancePlan(planInput({ machineId: 'nope' }), 'u1')).toMatchObject({
      ok: false,
      reason: 'unknown_machine',
    });
  });

  it('refuses a plan on an archived machine', () => {
    expect(repository.createMaintenancePlan(planInput({ machineId: 'm15' }), 'u1')).toMatchObject({
      ok: false,
      reason: 'already_archived',
    });
  });

  it('updates a plan', () => {
    const created = repository.createMaintenancePlan(planInput(), 'u1');
    if (!created.ok) return;

    const result = repository.updateMaintenancePlan(
      created.data.id,
      planInput({ intervalValue: 3, intervalUnit: 'months' }),
      'u1',
    );

    expect(result).toMatchObject({ ok: true, data: { intervalValue: 3, intervalUnit: 'months' } });
  });

  it('archives and restores a plan', () => {
    const created = repository.createMaintenancePlan(planInput(), 'u1');
    if (!created.ok) return;

    expect(repository.archiveMaintenancePlan(created.data.id, 'u1')).toMatchObject({ ok: true });
    expect(repository.getMaintenancePlanInScope(created.data.id, officer)?.isArchived).toBe(true);

    expect(repository.restoreMaintenancePlan(created.data.id, 'u1')).toMatchObject({ ok: true });
    expect(repository.getMaintenancePlanInScope(created.data.id, officer)?.isArchived).toBe(false);
  });

  it('refuses to edit an archived plan', () => {
    const created = repository.createMaintenancePlan(planInput(), 'u1');
    if (!created.ok) return;
    repository.archiveMaintenancePlan(created.data.id, 'u1');

    expect(repository.updateMaintenancePlan(created.data.id, planInput(), 'u1')).toMatchObject({
      ok: false,
      reason: 'already_archived',
    });
  });

  it("updates the plan's lastCompletedDate when a linked record completes", () => {
    const plan = repository.createMaintenancePlan(planInput(), 'u1');
    if (!plan.ok) return;

    const record = repository.createMaintenanceRecord(recordInput({ planId: plan.data.id }), 'u1');
    if (!record.ok) return;

    repository.completeMaintenanceRecord(record.data.id, 'u1', { actions: 'Done' });

    const updatedPlan = repository.getMaintenancePlanInScope(plan.data.id, officer);
    expect(updatedPlan?.lastCompletedDate).toBeDefined();
  });
});
