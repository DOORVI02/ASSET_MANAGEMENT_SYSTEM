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

/**
 * Walks a paged query to completion and returns every row.
 *
 * Used by the screens that filter, sort and paginate in the browser over a complete list —
 * multi-select statuses, derived due states, a record's full child history. Those are shapes
 * the single-value server-side filters don't express, and rewriting each screen around them
 * would be a much larger change than the cutover they belong to.
 *
 * The loop is not a formality. Two independent caps sit under it: `clampPageSize` refuses
 * anything above `MAX_PAGE_SIZE` (100), and PostgREST refuses anything above
 * `config.toml`'s `[api] max_rows` (1000). A single "just ask for everything" request
 * therefore cannot return more than 100 rows however it is written — it would simply return
 * a truncated list that looks complete.
 *
 * That is not hypothetical: the first version of this loop lived in `machines.ts` and
 * compared `rows.length` against its own *requested* page size of 1000 rather than the
 * clamped 100 it actually received, so it stopped after one page and silently capped the
 * register at 100 machines. Clamping here, once, is what makes the termination check compare
 * against the size the query really used.
 *
 * If a list ever grows large enough that holding it in memory is the problem, the fix is to
 * push that screen's filters into its query params and paginate server-side — not to raise
 * a cap.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const pageSize = clampPageSize(MAX_PAGE_SIZE);
  const all: T[] = [];

  for (let page = 1; ; page += 1) {
    const { rows, total } = await fetchPage(page, pageSize);
    all.push(...rows);
    // Stops on a short page as well as on the reported total, so a row deleted between
    // requests cannot turn this into an endless loop.
    if (rows.length < pageSize || all.length >= total) return all;
  }
}
