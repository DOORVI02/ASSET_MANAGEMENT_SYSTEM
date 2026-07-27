import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { RepairRecordInput } from './types';

function input(overrides: Partial<RepairRecordInput> = {}): RepairRecordInput {
  return {
    machineId: 'm1',
    reportedDate: '2026-07-26',
    reportedBy: 'Control room operator',
    description: 'Hydraulic pressure is dropping during operation.',
    ...overrides,
  };
}

describe('repair repository', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  it('creates a reported repair, derives the machine display fields, and changes effective status', () => {
    const result = repository.createRepairRecord(input(), 'u1');

    expect(result).toMatchObject({ ok: true, data: { status: 'reported', machineCode: 'HP-04' } });
    expect(repository.getMachine('m1')?.status).toBe('under_repair');
    if (!result.ok) return;
    expect(repository.listAuditLogsForEntity(result.data.id)[0]).toMatchObject({
      action: 'repair_reported',
      entityType: 'repair',
    });
  });

  it('rejects reporting against an unknown or archived machine', () => {
    expect(repository.createRepairRecord(input({ machineId: 'unknown' }), 'u1')).toMatchObject({
      ok: false,
      reason: 'unknown_machine',
    });
    expect(repository.createRepairRecord(input({ machineId: 'm15' }), 'u1')).toMatchObject({
      ok: false,
      reason: 'already_archived',
    });
  });

  it('enforces reported → in progress → waiting for parts → in progress → completed', () => {
    const created = repository.createRepairRecord(input({ machineId: 'm3' }), 'u1');
    if (!created.ok) return;
    expect(repository.waitForRepairParts(created.data.id, 'u1')).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
    expect(repository.startRepairRecord(created.data.id, 'u1')).toMatchObject({
      ok: true,
      data: { status: 'in_progress' },
    });
    expect(repository.waitForRepairParts(created.data.id, 'u1')).toMatchObject({
      ok: true,
      data: { status: 'waiting_for_parts' },
    });
    expect(
      repository.completeRepairRecord(created.data.id, 'u1', {
        diagnosis: 'Fault',
        resolution: 'Fixed',
      }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
    repository.startRepairRecord(created.data.id, 'u1');
    expect(
      repository.completeRepairRecord(created.data.id, 'u1', {
        diagnosis: 'Relief valve failed',
        resolution: 'Replaced and pressure tested',
        downtimeHours: 4,
      }),
    ).toMatchObject({
      ok: true,
      data: { status: 'completed', downtimeHours: 4 },
    });
    expect(repository.getMachine('m3')?.status).toBe('active');
  });

  it('requires diagnosis and resolution before completion and prevents closed transitions', () => {
    const created = repository.createRepairRecord(input(), 'u1');
    if (!created.ok) return;
    repository.startRepairRecord(created.data.id, 'u1');
    expect(
      repository.completeRepairRecord(created.data.id, 'u1', { diagnosis: '', resolution: '' }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
    repository.completeRepairRecord(created.data.id, 'u1', {
      diagnosis: 'Fault',
      resolution: 'Fixed',
    });
    expect(repository.startRepairRecord(created.data.id, 'u1')).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
    expect(repository.updateRepairRecord(created.data.id, input(), 'u1')).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
  });

  it('cancels an open repair, restores maintenance precedence, and records the reason', () => {
    const created = repository.createRepairRecord(input({ machineId: 'm2' }), 'u1');
    if (!created.ok) return;
    // m2 has an in-progress maintenance record in the fixtures.
    expect(
      repository.cancelRepairRecord(created.data.id, 'u1', 'Fault cleared after inspection'),
    ).toMatchObject({
      ok: true,
      data: { status: 'cancelled', remarks: 'Fault cleared after inspection' },
    });
    expect(repository.getMachine('m2')?.status).toBe('under_maintenance');
    expect(repository.cancelRepairRecord(created.data.id, 'u1')).toMatchObject({
      ok: false,
      reason: 'invalid_state',
    });
  });

  it('stores multiple repair evidence attachments and removes one without deleting history', () => {
    const created = repository.createRepairRecord(input(), 'u1');
    if (!created.ok) return;
    const one = repository.addRepairAttachment(
      created.data.id,
      { fileName: 'fault.png', fileType: 'image/png', fileSize: 100, url: 'blob:fault' },
      'u1',
    );
    const two = repository.addRepairAttachment(
      created.data.id,
      { fileName: 'repair.png', fileType: 'image/png', fileSize: 100, url: 'blob:repair' },
      'u1',
    );
    expect(one.ok && two.ok).toBe(true);
    expect(repository.listRepairAttachments(created.data.id)).toHaveLength(2);
    if (!one.ok) return;
    expect(repository.removeRepairAttachment(created.data.id, one.data.id, 'u1')).toMatchObject({
      ok: true,
    });
    expect(repository.listRepairAttachments(created.data.id)).toHaveLength(1);
  });

  it('keeps repair data department-scoped and summarizes downtime', () => {
    const coal = { departmentIds: ['d3'], includeArchived: false };
    const plate = { departmentIds: ['d15'], includeArchived: true };
    expect(repository.getRepairRecordInScope('rr1', coal)?.machineCode).toBe('CD-11');
    expect(repository.getRepairRecordInScope('rr1', plate)).toBeUndefined();
    expect(repository.getRepairSummary('d3', coal)).toMatchObject({
      inProgress: 1,
      downtimeHours: 28,
    });
  });
});
