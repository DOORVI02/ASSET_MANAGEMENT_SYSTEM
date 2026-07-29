/**
 * Persistence for the Officer's chosen department.
 *
 * `resolveScopeIds` used to live here: it derived a user's authorized department ids by
 * matching `UserProfile.departmentScope` (names) against a locally held department list.
 * It was removed in the 2026-07-29 backend cutover — RLS on `departments` already returns
 * exactly the caller's scope, so `DepartmentProvider` reads the ids from the query result
 * instead of recomputing them from names. Two sources that could disagree became one that
 * cannot.
 */

/** localStorage key holding the Officer's chosen department so it survives logout. */
export const DEPARTMENT_STORAGE_KEY = 'sail_department';

export function readStoredDepartmentId(): string | null {
  try {
    return window.localStorage.getItem(DEPARTMENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredDepartmentId(departmentId: string): void {
  try {
    window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
  } catch {
    // Persistence is best-effort; selection still applies for the current session.
  }
}

export function clearStoredDepartmentId(): void {
  try {
    window.localStorage.removeItem(DEPARTMENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
