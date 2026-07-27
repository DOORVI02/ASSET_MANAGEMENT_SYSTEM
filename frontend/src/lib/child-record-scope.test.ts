import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { AccessScope } from './types';

/** Supervisor-like: Coal Handling only, archived hidden. */
const coalHandling: AccessScope = { departmentIds: ['d3'], includeArchived: false };
/** Officer-like: Plate Mill and Power Plants, archived visible. */
const officer: AccessScope = { departmentIds: ['d15', 'd16'], includeArchived: true };
const empty: AccessScope = { departmentIds: [], includeArchived: false };

describe('maintenance and repair scoping', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  /** A child record is visible only when its parent machine is. */
  function machineIdsFor(scope: AccessScope): Set<string> {
    return new Set(repository.listMachinesInScope(scope).map((machine) => machine.id));
  }

  it('returns only maintenance for machines in scope', () => {
    const allowed = machineIdsFor(officer);
    const records = repository.listMaintenanceInScope(officer);

    expect(records.every((record) => allowed.has(record.machineId))).toBe(true);
  });

  it('returns only repairs for machines in scope', () => {
    const allowed = machineIdsFor(officer);
    const records = repository.listRepairsInScope(officer);

    expect(records.every((record) => allowed.has(record.machineId))).toBe(true);
  });

  it('returns only parts for machines in scope', () => {
    const allowed = machineIdsFor(officer);
    const parts = repository.listPartsInScope(officer);

    expect(parts.every((part) => allowed.has(part.machineId))).toBe(true);
  });

  it('withholds a repair whose machine is in another department', () => {
    // rr1 belongs to m6 (CD-11) in Coal Handling.
    const inDept = repository.listRepairsInScope(coalHandling);
    const otherDept = repository.listRepairsInScope(officer);

    expect(inDept.some((record) => record.machineId === 'm6')).toBe(true);
    expect(otherDept.some((record) => record.machineId === 'm6')).toBe(false);
  });

  it('withholds maintenance for an archived machine when archived is hidden', () => {
    // Archiving m6 must remove its maintenance from a supervisor's view entirely.
    const before = repository.listMaintenanceInScope(coalHandling).length;
    repository.archiveMachine('m6', 'u1');
    const after = repository.listMaintenanceInScope(coalHandling);

    expect(after.some((record) => record.machineId === 'm6')).toBe(false);
    expect(after.length).toBeLessThanOrEqual(before);
  });

  it("still shows an archived machine's history to an officer who can see archived", () => {
    const scope: AccessScope = { departmentIds: ['d3'], includeArchived: true };
    repository.archiveMachine('m6', 'u1');

    expect(repository.listRepairsInScope(scope).some((record) => record.machineId === 'm6')).toBe(
      true,
    );
  });

  it('scopes department reads and refuses departments outside the scope', () => {
    expect(repository.listMaintenanceForDepartment('d15', coalHandling)).toEqual([]);
    expect(repository.listRepairsForDepartment('d15', coalHandling)).toEqual([]);
    expect(repository.listRepairsForDepartment('d3', coalHandling).length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty scope', () => {
    expect(repository.listMaintenanceInScope(empty)).toEqual([]);
    expect(repository.listRepairsInScope(empty)).toEqual([]);
    expect(repository.listPartsInScope(empty)).toEqual([]);
  });

  it('orders maintenance newest first and repairs newest reported first', () => {
    const maintenance = repository.listMaintenanceInScope(officer);
    const repairs = repository.listRepairsInScope(officer);

    for (let i = 1; i < maintenance.length; i += 1) {
      expect(new Date(maintenance[i - 1].scheduledDate).getTime()).toBeGreaterThanOrEqual(
        new Date(maintenance[i].scheduledDate).getTime(),
      );
    }
    for (let i = 1; i < repairs.length; i += 1) {
      expect(new Date(repairs[i - 1].reportedDate).getTime()).toBeGreaterThanOrEqual(
        new Date(repairs[i].reportedDate).getTime(),
      );
    }
  });
});
