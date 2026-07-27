import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { MachineInput } from './types';

function machineInput(overrides: Partial<MachineInput> = {}): MachineInput {
  return {
    code: 'NEW-01',
    name: 'New Test Machine',
    departmentId: 'd1',
    type: 'pump',
    manufacturer: 'Test Manufacturer',
    model: 'T-100',
    installationDate: '2020-01-15',
    nextMaintenanceDate: '2026-12-01',
    location: 'Bay 9',
    status: 'active',
    description: 'Created by a unit test.',
    ...overrides,
  };
}

describe('mock repository', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  it('returns fixture copies instead of mutable references', () => {
    const firstRead = repository.listMachines();
    firstRead[0].name = 'Changed outside the repository';

    expect(repository.listMachines()[0].name).toBe('Hydraulic Press');
  });

  describe('createMachine', () => {
    it('adds a machine, derives the department name, and records an audit event', () => {
      const result = repository.createMachine(machineInput(), 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toMatchObject({
        code: 'NEW-01',
        department: 'Coke Ovens',
        departmentId: 'd1',
        isArchived: false,
      });
      expect(repository.getMachine(result.data.id)).toBeDefined();
      expect(repository.listAuditLogsForEntity(result.data.id)[0]).toMatchObject({
        action: 'created',
        performedBy: 'u1',
      });
    });

    it('rejects a duplicate machine code regardless of casing or padding', () => {
      const result = repository.createMachine(machineInput({ code: '  hp-04 ' }), 'u1');

      expect(result).toMatchObject({ ok: false, reason: 'duplicate_code' });
    });

    it('rejects an unknown department', () => {
      const result = repository.createMachine(machineInput({ departmentId: 'nope' }), 'u1');

      expect(result).toMatchObject({ ok: false, reason: 'unknown_department' });
    });

    it('normalizes blank optional fields to undefined rather than empty strings', () => {
      const result = repository.createMachine(
        machineInput({ serialNumber: '   ', capacity: '' }),
        'u1',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.serialNumber).toBeUndefined();
      expect(result.data.capacity).toBeUndefined();
    });
  });

  describe('updateMachine', () => {
    it('applies changes and describes them in the audit trail', () => {
      const result = repository.updateMachine('m1', machineInput({ code: 'HP-04' }), 'u2');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.name).toBe('New Test Machine');
      expect(repository.listAuditLogsForEntity('m1')[0].changes).toContain('Name');
    });

    it('allows a machine to keep its own code', () => {
      const result = repository.updateMachine('m1', machineInput({ code: 'HP-04' }), 'u1');

      expect(result.ok).toBe(true);
    });

    it("rejects taking another machine's code", () => {
      const result = repository.updateMachine('m1', machineInput({ code: 'RM-12' }), 'u1');

      expect(result).toMatchObject({ ok: false, reason: 'duplicate_code' });
    });

    it('rejects a missing machine', () => {
      const result = repository.updateMachine('does-not-exist', machineInput(), 'u1');

      expect(result).toMatchObject({ ok: false, reason: 'not_found' });
    });

    it('refuses to edit an archived machine', () => {
      const result = repository.updateMachine('m15', machineInput({ code: 'CB-05' }), 'u1');

      expect(result).toMatchObject({ ok: false, reason: 'already_archived' });
    });
  });

  describe('archive and restore', () => {
    it('archives a machine, retires it, and records an audit event', () => {
      const result = repository.archiveMachine('m1', 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.getMachine('m1')).toMatchObject({ isArchived: true, status: 'retired' });
      expect(repository.listAuditLogsForEntity('m1')[0]).toMatchObject({ action: 'archived' });
    });

    it('refuses to archive an already archived machine', () => {
      expect(repository.archiveMachine('m15', 'u1')).toMatchObject({
        ok: false,
        reason: 'already_archived',
      });
    });

    it('restores an archived machine as inactive for review', () => {
      const result = repository.restoreMachine('m15', 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.getMachine('m15')).toMatchObject({
        isArchived: false,
        status: 'inactive',
      });
    });

    it('refuses to restore a machine that is not archived', () => {
      expect(repository.restoreMachine('m1', 'u1')).toMatchObject({
        ok: false,
        reason: 'not_archived',
      });
    });
  });

  describe('machine-scoped reads', () => {
    it('returns only records belonging to the requested machine', () => {
      expect(repository.listMaintenanceForMachine('m1').every((r) => r.machineId === 'm1')).toBe(
        true,
      );
      expect(repository.listRepairsForMachine('m6').every((r) => r.machineId === 'm6')).toBe(true);
      expect(repository.listPartsForMachine('m1').every((p) => p.machineId === 'm1')).toBe(true);
    });

    it('returns an empty list for a machine with no related records', () => {
      expect(repository.listPartsForMachine('m14')).toEqual([]);
    });
  });

  describe('machine image', () => {
    const upload = { fileName: 'new.png', fileType: 'image/png', fileSize: 1024, url: 'blob:new' };

    it('sets an image on a machine that has none', () => {
      const result = repository.setMachineImage('m14', upload, 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.getMachineImage('m14')).toMatchObject({ fileName: 'new.png' });
      expect(repository.getMachine('m14')?.imageUrl).toBe('blob:new');
    });

    it('replaces the existing image rather than adding a second one', () => {
      const before = repository.getMachineImage('m1');
      expect(before).toBeDefined();

      const result = repository.setMachineImage('m1', upload, 'u1');
      expect(result).toMatchObject({ ok: true });

      const after = repository.getMachineImage('m1');
      expect(after?.fileName).toBe('new.png');
      expect(after?.id).not.toBe(before?.id);
      expect(repository.getMachine('m1')?.imageUrl).toBe('blob:new');
      expect(repository.listAuditLogsForEntity('m1')[0]).toMatchObject({
        action: 'image_replaced',
      });
    });

    it('records a first upload as image_set, not image_replaced', () => {
      repository.setMachineImage('m14', upload, 'u1');

      expect(repository.listAuditLogsForEntity('m14')[0]).toMatchObject({ action: 'image_set' });
    });

    it('removes the image and clears the machine reference', () => {
      const result = repository.removeMachineImage('m1', 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.getMachineImage('m1')).toBeUndefined();
      expect(repository.getMachine('m1')?.imageUrl).toBeUndefined();
    });

    it('refuses to remove an image that does not exist', () => {
      expect(repository.removeMachineImage('m14', 'u1')).toMatchObject({
        ok: false,
        reason: 'not_found',
      });
    });

    it('refuses image changes on an archived machine', () => {
      expect(repository.setMachineImage('m15', upload, 'u1')).toMatchObject({
        ok: false,
        reason: 'already_archived',
      });
      expect(repository.removeMachineImage('m15', 'u1')).toMatchObject({
        ok: false,
        reason: 'already_archived',
      });
    });

    it('refuses image changes on a machine that does not exist', () => {
      expect(repository.setMachineImage('nope', upload, 'u1')).toMatchObject({
        ok: false,
        reason: 'not_found',
      });
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers and advances the version on a write', () => {
      const listener = vi.fn();
      const unsubscribe = repository.subscribe(listener);
      const before = repository.getVersion();

      repository.createMachine(machineInput(), 'u1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(repository.getVersion()).toBeGreaterThan(before);

      unsubscribe();
      repository.archiveMachine('m1', 'u1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when a write fails validation', () => {
      const listener = vi.fn();
      repository.subscribe(listener);

      repository.createMachine(machineInput({ code: 'HP-04' }), 'u1');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('restores fixture state on reset', () => {
    repository.archiveMachine('m1', 'u1');
    repository.reset();

    expect(repository.getMachine('m1')).toMatchObject({ isArchived: false, status: 'active' });
  });
});
