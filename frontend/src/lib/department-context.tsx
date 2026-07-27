import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { DepartmentContext, type DepartmentContextValue } from '@/hooks/use-department';
import {
  clearStoredDepartmentId,
  readStoredDepartmentId,
  resolveScopeIds,
  writeStoredDepartmentId,
} from '@/lib/department-scope';
import type { AccessScope } from '@/lib/types';

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const repository = useMockRepository();
  const [storedId, setStoredId] = useState<string | null>(readStoredDepartmentId);

  const departments = useMemo(() => repository.listDepartments(), [repository]);
  const scopeIds = useMemo(() => resolveScopeIds(user, departments), [user, departments]);

  const available = useMemo(
    () => departments.filter((department) => scopeIds.includes(department.id)),
    [departments, scopeIds],
  );

  // Officers may see archived records; Supervisors may not.
  const scope = useMemo<AccessScope>(
    () => ({ departmentIds: scopeIds, includeArchived: can(user, 'machine:archive') }),
    [scopeIds, user],
  );

  const canChoose = available.length > 1;

  /**
   * A Supervisor has exactly one department, so it is selected implicitly.
   *
   * A stored department outside the user's current scope resolves to `null` rather than
   * being trusted, which is what makes persisting across logout safe: after a role or
   * roster change the shell sends the user back to selection instead of showing data
   * they no longer have access to. The stale value is harmless and is overwritten on the
   * next selection, so no cleanup effect is needed.
   */
  const current = useMemo(() => {
    if (!user) return null;
    if (available.length === 1) return available[0];
    if (!storedId) return null;
    return available.find((department) => department.id === storedId) ?? null;
  }, [user, available, storedId]);

  const selectDepartment = useCallback((departmentId: string) => {
    writeStoredDepartmentId(departmentId);
    setStoredId(departmentId);
  }, []);

  const clearDepartment = useCallback(() => {
    clearStoredDepartmentId();
    setStoredId(null);
  }, []);

  const value = useMemo<DepartmentContextValue>(
    () => ({ available, current, scope, canChoose, selectDepartment, clearDepartment }),
    [available, current, scope, canChoose, selectDepartment, clearDepartment],
  );

  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}
