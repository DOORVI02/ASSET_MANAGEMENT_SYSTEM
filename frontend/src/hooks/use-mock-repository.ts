import { useMemo, useSyncExternalStore } from 'react';
import { mockRepository } from '@/lib/mock-repository';
import type { MockRepository } from '@/lib/mock-repository';

/**
 * Subscribes a component to in-memory repository writes.
 *
 * Repository reads return fresh deep copies, so a snapshot cannot be compared by
 * reference. The store exposes a monotonic version counter instead, and this hook
 * turns that counter into a new repository identity after every write. Callers then
 * depend on the returned value like any other reactive input:
 *
 * ```ts
 * const repository = useMockRepository();
 * const machines = useMemo(() => repository.listMachines(), [repository]);
 * ```
 *
 * Supabase + TanStack Query replaces this in Phase 11.
 */
export function useMockRepository(): MockRepository {
  const version = useSyncExternalStore(
    mockRepository.subscribe,
    mockRepository.getVersion,
    mockRepository.getVersion,
  );

  // Returning the singleton itself would keep the same object identity forever and
  // downstream `useMemo(..., [repository])` reads would never re-run. A shallow copy
  // per version gives callers a dependency that actually changes after each write.
  // Every repository member is a closure over private state, so copying is safe.
  // `version` is deliberately the only dependency — it is the change signal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...mockRepository }), [version]);
}
