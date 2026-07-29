/**
 * TanStack Query key factory. Not consumed by any page yet (Phase 11 built the data
 * layer before the page-level cutover — see `.agents/phases.md`), but the shape is
 * fixed now so query and invalidation code written later has one convention to follow
 * rather than each page inventing its own key structure.
 *
 * Keys are arrays, most-general first, so `invalidateQueries({ queryKey:
 * queryKeys.machines.all(departmentId) })` correctly invalidates every filtered/paged
 * variant under it — a bare string key could not express that.
 */
/**
 * A scope is a set of department ids, and the same set can arrive in different orders from
 * different call sites. Sorting and joining makes the key depend on the set rather than on
 * the array, so two components asking for the same scope share one cache entry instead of
 * silently fetching twice.
 */
function scopeKey(departmentIds: readonly string[]): string {
  return [...departmentIds].sort().join(',');
}

export const queryKeys = {
  departments: {
    all: () => ['departments'] as const,
    list: () => ['departments', 'list'] as const,
    summary: (departmentId: string) => ['departments', departmentId, 'summary'] as const,
  },
  machines: {
    all: (departmentId: string) => ['machines', departmentId] as const,
    list: (departmentId: string, filters: unknown) =>
      ['machines', departmentId, 'list', filters] as const,
    inScope: (departmentIds: readonly string[]) =>
      ['machines', 'scope', scopeKey(departmentIds)] as const,
    detail: (machineId: string) => ['machines', 'detail', machineId] as const,
    image: (machineId: string) => ['machines', 'detail', machineId, 'image'] as const,
    audit: (machineId: string) => ['machines', 'detail', machineId, 'audit'] as const,
  },
  parts: {
    all: (departmentId: string) => ['parts', departmentId] as const,
    list: (departmentId: string, filters: unknown) =>
      ['parts', departmentId, 'list', filters] as const,
    detail: (partId: string) => ['parts', 'detail', partId] as const,
    replacements: (partId: string) => ['parts', 'detail', partId, 'replacements'] as const,
    summary: (departmentId: string) => ['parts', departmentId, 'summary'] as const,
  },
  maintenance: {
    all: (departmentId: string) => ['maintenance', departmentId] as const,
    records: (departmentId: string, filters: unknown) =>
      ['maintenance', departmentId, 'records', filters] as const,
    plans: (departmentId: string, filters: unknown) =>
      ['maintenance', departmentId, 'plans', filters] as const,
    recordDetail: (recordId: string) => ['maintenance', 'record', recordId] as const,
    planDetail: (planId: string) => ['maintenance', 'plan', planId] as const,
    summary: (departmentId: string) => ['maintenance', departmentId, 'summary'] as const,
  },
  repairs: {
    all: (departmentId: string) => ['repairs', departmentId] as const,
    list: (departmentId: string, filters: unknown) =>
      ['repairs', departmentId, 'list', filters] as const,
    detail: (repairId: string) => ['repairs', 'detail', repairId] as const,
    summary: (departmentId: string) => ['repairs', departmentId, 'summary'] as const,
  },
  technicians: {
    list: () => ['technicians', 'list'] as const,
  },
  profiles: {
    names: () => ['profiles', 'names'] as const,
  },
} as const;
