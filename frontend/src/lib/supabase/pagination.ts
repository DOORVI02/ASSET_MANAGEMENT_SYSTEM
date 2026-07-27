/**
 * Shared pagination/sorting convention for every domain query.
 *
 * Bounded: `pageSize` is always clamped, so a caller can never accidentally request an
 * unbounded full-table load into the browser (`.agents/phases.md` Phase 11 explicitly
 * calls this out as a regression to guard against).
 *
 * Deterministic: every `.range()` call must be paired with an `.order()` that includes
 * a unique tie-breaker column (`id`), never just the user-facing sort column alone —
 * otherwise two rows with an equal sort value can trade places between pages as the
 * underlying table changes, silently duplicating or hiding a row.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export function clampPageSize(requested: number | undefined): number {
  if (!requested || !Number.isFinite(requested) || requested <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(requested), MAX_PAGE_SIZE);
}

export interface PageRange {
  from: number;
  to: number;
}

/** 1-indexed page number, matching `Pagination.tsx`'s existing `currentPage` convention. */
export function toRange(page: number, pageSize: number): PageRange {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * Every list query returns this rather than a bare array, so a page can render
 * "N of M" and compute total pages without ever loading the full table — the mock
 * repository could return everything and let pages slice client-side; a real Supabase
 * query must not.
 */
export interface PagedResult<T> {
  rows: T[];
  total: number;
}

export interface OrderSpec {
  column: string;
  ascending?: boolean;
}

/**
 * Appends `id` as a tie-breaker unless the caller is already sorting by it, so
 * `.order()` calls built from this are always deterministic across pages.
 */
export function withTieBreaker(order: OrderSpec): [OrderSpec, OrderSpec] | [OrderSpec] {
  if (order.column === 'id') return [order];
  return [order, { column: 'id', ascending: true }];
}
