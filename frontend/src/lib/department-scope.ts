import type { Department, UserProfile } from './types';

/** localStorage key holding the Officer's chosen department so it survives logout. */
export const DEPARTMENT_STORAGE_KEY = 'sail_department';

/**
 * Resolves a user's authorized department ids.
 *
 * `UserProfile.departmentScope` holds department *names* today. Names are resolved to
 * ids here so the rest of the app works in ids. Normalizing the profile contract to
 * ids belongs to the schema work in Phase 9.
 *
 * A Supervisor is pinned to exactly one department, their assigned one, regardless of
 * what `departmentScope` happens to contain.
 */
export function resolveScopeIds(user: UserProfile | null, departments: Department[]): string[] {
  if (!user) return [];

  if (user.role === 'supervisor') {
    const assigned = departments.find((department) => department.name === user.department);
    return assigned ? [assigned.id] : [];
  }

  const names = new Set(user.departmentScope);
  return departments
    .filter((department) => names.has(department.name))
    .map((department) => department.id);
}

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
