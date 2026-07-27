import { describe, expect, it } from 'vitest';
import { resolveScopeIds } from './department-scope';
import { mockDepartments, mockUsers } from './mock-data';
import type { UserProfile } from './types';

const officer = mockUsers['officer@sail.in'];
const supervisor = mockUsers['supervisor@sail.in'];

describe('department scope resolution', () => {
  it('gives an officer only their associated departments, not every department', () => {
    const ids = resolveScopeIds(officer, mockDepartments);

    expect(ids.length).toBe(officer.departmentScope.length);
    expect(ids.length).toBeLessThan(mockDepartments.length);
  });

  it('resolves officer scope names to matching department ids', () => {
    const ids = resolveScopeIds(officer, mockDepartments);
    const names = ids.map((id) => mockDepartments.find((d) => d.id === id)?.name);

    expect(new Set(names)).toEqual(new Set(officer.departmentScope));
  });

  it('pins a supervisor to exactly their assigned department', () => {
    const ids = resolveScopeIds(supervisor, mockDepartments);
    const assigned = mockDepartments.find((d) => d.name === supervisor.department);

    expect(ids).toEqual([assigned?.id]);
  });

  it('pins a supervisor to one department even if the scope lists several', () => {
    const greedy: UserProfile = {
      ...supervisor,
      departmentScope: mockDepartments.map((d) => d.name),
    };

    expect(resolveScopeIds(greedy, mockDepartments)).toHaveLength(1);
  });

  it('returns no departments for a signed-out user', () => {
    expect(resolveScopeIds(null, mockDepartments)).toEqual([]);
  });

  it('returns no departments when a name matches nothing', () => {
    const orphan: UserProfile = { ...officer, departmentScope: ['Nonexistent Department'] };

    expect(resolveScopeIds(orphan, mockDepartments)).toEqual([]);
  });
});
