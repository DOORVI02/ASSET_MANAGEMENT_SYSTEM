import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEPARTMENT_STORAGE_KEY,
  clearStoredDepartmentId,
  readStoredDepartmentId,
  writeStoredDepartmentId,
} from './department-scope';

/**
 * This file used to test `resolveScopeIds`, which derived a user's authorized department
 * ids by matching profile department *names* against a local department list. That function
 * was deleted in the 2026-07-29 backend cutover: RLS on `departments` returns exactly the
 * caller's scope, so `DepartmentProvider` uses the query result directly.
 *
 * The behaviours those tests guarded are now enforced where they belong and verified
 * against the real database, not asserted against fixtures:
 *
 * - "an officer sees only their associated departments" and "a supervisor is pinned to
 *   one" — `supabase/scripts/verify-supervisor-scope-rule.mjs`, plus the real sign-in check
 *   run when the first two accounts were provisioned (the officer's unfiltered
 *   `select * from departments` returned 4 rows, the supervisor's returned 1).
 * - "a supervisor cannot hold several departments" — a database trigger, which is also
 *   where the 2026-07-29 batch-insert bypass was found and fixed.
 *
 * What remains here is the part that is genuinely browser-side: persisting the Officer's
 * chosen department, and surviving a `localStorage` that throws.
 */
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('stored department selection', () => {
  it('round-trips a selected department id', () => {
    writeStoredDepartmentId('dept-1');

    expect(readStoredDepartmentId()).toBe('dept-1');
    expect(window.localStorage.getItem(DEPARTMENT_STORAGE_KEY)).toBe('dept-1');
  });

  it('reports no selection when nothing has been stored', () => {
    expect(readStoredDepartmentId()).toBeNull();
  });

  it('clears a selection', () => {
    writeStoredDepartmentId('dept-1');
    clearStoredDepartmentId();

    expect(readStoredDepartmentId()).toBeNull();
  });

  it('overwrites a previous selection rather than accumulating', () => {
    writeStoredDepartmentId('dept-1');
    writeStoredDepartmentId('dept-2');

    expect(readStoredDepartmentId()).toBe('dept-2');
  });

  /**
   * Storage throws in a Safari private window and whenever the origin's quota is full.
   * Persistence is a convenience; losing it must not take the app down with it, because
   * the selection still applies for the current session either way.
   */
  it('survives a localStorage that throws on read', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readStoredDepartmentId()).toBeNull();
  });

  it('survives a localStorage that throws on write', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writeStoredDepartmentId('dept-1')).not.toThrow();
  });

  it('survives a localStorage that throws on clear', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => clearStoredDepartmentId()).not.toThrow();
  });
});
