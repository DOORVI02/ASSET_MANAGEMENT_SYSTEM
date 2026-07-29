import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { DepartmentContext, type DepartmentContextValue } from '@/hooks/use-department';
import { listAccessibleDepartments } from '@/lib/supabase/departments';
import { queryKeys } from '@/lib/supabase/query-keys';
import {
  clearStoredDepartmentId,
  readStoredDepartmentId,
  writeStoredDepartmentId,
} from '@/lib/department-scope';
import type { AccessScope, Department } from '@/lib/types';

/** Stable empty array: a fresh `[]` per render would re-run every downstream memo. */
const NO_DEPARTMENTS: Department[] = [];

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storedId, setStoredId] = useState<string | null>(readStoredDepartmentId);

  /**
   * The accessible department list *is* the user's scope. RLS on `departments` already
   * restricts the result to the caller's `profile_department_scope`
   * (`20260727000013_rls_policies_and_grants.sql`), so there is nothing left to filter in
   * the browser.
   *
   * This replaces the preview's `resolveScopeIds`, which matched `user.departmentScope`
   * (department *names*) against a locally held department list. That could disagree with
   * what the database would actually return — a rename, or a scope change that hadn't
   * reached the browser yet, would silently show or hide a department. Deriving scope from
   * the query result removes the possibility of the two disagreeing at all.
   */
  const { data: departments, isPending } = useQuery({
    queryKey: queryKeys.departments.list(),
    queryFn: listAccessibleDepartments,
    // Nothing to fetch, and no session to fetch it with, until someone is signed in.
    enabled: Boolean(user),
    // Department membership changes about as often as the roster does, i.e. rarely — but a
    // scope change must not require a hard reload to take effect.
    staleTime: 5 * 60 * 1000,
  });

  const available = departments ?? NO_DEPARTMENTS;
  const scopeIds = useMemo(() => available.map((department) => department.id), [available]);

  // Officers may see archived records; Supervisors may not.
  const scope = useMemo<AccessScope>(
    () => ({ departmentIds: scopeIds, includeArchived: can(user, 'machine:archive') }),
    [scopeIds, user],
  );

  const canChoose = available.length > 1;
  const isLoading = Boolean(user) && isPending;

  /**
   * A Supervisor has exactly one department, so it is selected implicitly.
   *
   * A stored department outside the user's current scope resolves to `null` rather than
   * being trusted, which is what makes persisting across logout safe: after a role or
   * roster change the shell sends the user back to selection instead of showing data
   * they no longer have access to. The stale value is harmless and is overwritten on the
   * next selection, so no cleanup effect is needed.
   *
   * Also held at `null` while the list is still loading. Resolving during the first fetch
   * would make every signed-in Officer momentarily look like they had nothing selected,
   * and the shell's guard would bounce them to the selection screen and back.
   */
  const current = useMemo(() => {
    if (!user || isLoading) return null;
    if (available.length === 1) return available[0];
    if (!storedId) return null;
    return available.find((department) => department.id === storedId) ?? null;
  }, [user, isLoading, available, storedId]);

  const selectDepartment = useCallback((departmentId: string) => {
    writeStoredDepartmentId(departmentId);
    setStoredId(departmentId);
  }, []);

  const clearDepartment = useCallback(() => {
    clearStoredDepartmentId();
    setStoredId(null);
  }, []);

  const value = useMemo<DepartmentContextValue>(
    () => ({
      available,
      current,
      scope,
      canChoose,
      isLoading,
      selectDepartment,
      clearDepartment,
    }),
    [available, current, scope, canChoose, isLoading, selectDepartment, clearDepartment],
  );

  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}
