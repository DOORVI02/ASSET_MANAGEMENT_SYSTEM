import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { AccessScope } from './types';

/** Officer-like: several departments, archived visible. */
const officerScope: AccessScope = {
  departmentIds: ['d15', 'd3', 'd16'],
  includeArchived: true,
};
/** Supervisor-like: one department, archived hidden. */
const supervisorScope: AccessScope = { departmentIds: ['d3'], includeArchived: false };
const emptyScope: AccessScope = { departmentIds: [], includeArchived: false };

describe('repository access scoping', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  it('returns only machines in the allowed departments', () => {
    const machines = repository.listMachinesInScope(officerScope);

    expect(machines.length).toBeGreaterThan(0);
    expect(machines.every((m) => officerScope.departmentIds.includes(m.departmentId))).toBe(true);
  });

  it('never returns archived machines when archived visibility is off', () => {
    // m15 is archived and lives in d16.
    const withArchived = repository.listMachinesInScope(officerScope);
    const withoutArchived = repository.listMachinesInScope({
      departmentIds: ['d16'],
      includeArchived: false,
    });

    expect(withArchived.some((m) => m.isArchived)).toBe(true);
    expect(withoutArchived.some((m) => m.isArchived)).toBe(false);
  });

  it('hides an archived machine from getMachineInScope when archived is not visible', () => {
    const asOfficer = repository.getMachineInScope('m15', {
      departmentIds: ['d16'],
      includeArchived: true,
    });
    const asSupervisor = repository.getMachineInScope('m15', {
      departmentIds: ['d16'],
      includeArchived: false,
    });

    expect(asOfficer).toBeDefined();
    expect(asSupervisor).toBeUndefined();
  });

  it('refuses a machine outside the allowed departments', () => {
    // m1 is in d15, which the supervisor scope does not include.
    expect(repository.getMachineInScope('m1', supervisorScope)).toBeUndefined();
    expect(repository.getMachine('m1')).toBeDefined();
  });

  it('returns nothing at all for an empty scope', () => {
    expect(repository.listMachinesInScope(emptyScope)).toEqual([]);
    expect(repository.listDepartmentsInScope(emptyScope)).toEqual([]);
    expect(repository.getMachineInScope('m1', emptyScope)).toBeUndefined();
  });

  it('returns an empty list for a department outside the scope', () => {
    expect(repository.listMachinesForDepartment('d15', supervisorScope)).toEqual([]);
    expect(repository.listMachinesForDepartment('d3', supervisorScope).length).toBeGreaterThan(0);
  });

  it('scopes departments to the allow-list', () => {
    const departments = repository.listDepartmentsInScope(officerScope);

    expect(departments.map((d) => d.id).sort()).toEqual(['d15', 'd16', 'd3'].sort());
  });

  it('reports department membership', () => {
    expect(repository.isDepartmentInScope('d3', supervisorScope)).toBe(true);
    expect(repository.isDepartmentInScope('d15', supervisorScope)).toBe(false);
  });

  describe('department summary', () => {
    it('counts only machines in that department and scope', () => {
      const summary = repository.getDepartmentSummary('d3', supervisorScope);
      const machines = repository.listMachinesForDepartment('d3', supervisorScope);

      expect(summary.total).toBe(machines.length);
      expect(summary.departmentId).toBe('d3');
    });

    it('never counts archived machines when archived visibility is off', () => {
      const visible = repository.getDepartmentSummary('d16', {
        departmentIds: ['d16'],
        includeArchived: true,
      });
      const hidden = repository.getDepartmentSummary('d16', {
        departmentIds: ['d16'],
        includeArchived: false,
      });

      expect(visible.retired).toBeGreaterThan(hidden.retired);
      expect(hidden.total).toBeLessThan(visible.total);
    });

    it('returns zeroes for a department outside the scope', () => {
      expect(repository.getDepartmentSummary('d15', supervisorScope)).toMatchObject({
        total: 0,
        active: 0,
        overdue: 0,
      });
    });

    it('keeps status counts summing to the total', () => {
      const s = repository.getDepartmentSummary('d16', officerScope);

      expect(s.active + s.inactive + s.underMaintenance + s.underRepair + s.retired).toBe(s.total);
    });

    it('reflects a write through the scoped summary', () => {
      const before = repository.getDepartmentSummary('d3', supervisorScope);
      const target = repository.listMachinesForDepartment('d3', supervisorScope)[0];

      repository.archiveMachine(target.id, 'u1');
      const after = repository.getDepartmentSummary('d3', supervisorScope);

      // Archiving hides the machine from a supervisor entirely.
      expect(after.total).toBe(before.total - 1);
    });
  });
});
