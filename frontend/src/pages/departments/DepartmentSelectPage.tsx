import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/shared/SearchBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDepartment } from '@/hooks/use-department';
import { getDepartmentSummary } from '@/lib/supabase/departments';
import { queryKeys } from '@/lib/supabase/query-keys';
import { DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { registeredRoutes } from '@/lib/routes';

/**
 * Renders a count, or an em dash while it is still being fetched.
 *
 * Showing 0 during loading would be a lie that reads as fact — "this department has no
 * overdue machines" is exactly the kind of statement someone acts on.
 */
function cell(value: number | undefined, isPending: boolean): string {
  if (isPending) return '—';
  return String(value ?? 0);
}

/**
 * Officer landing page: choose which authorized department to work in.
 *
 * Only departments in the user's scope are listed. Supervisors never reach this page
 * because their single department is selected implicitly.
 *
 * Reached two ways: first sign-in with no department chosen yet (`current` is null,
 * no Back action makes sense), or the header's Change action while a department is
 * already selected (`current` is set, so Back can return there without changing
 * anything).
 */
export default function DepartmentSelectPage() {
  const { available, current, scope, selectDepartment } = useDepartment();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');

  /**
   * One query per department, read from the `department_summary` view rather than counted in
   * the browser — the view already aggregates status and due counts in SQL, and this screen
   * would otherwise have to load every machine in every department just to display six
   * numbers per card.
   *
   * `useQueries` rather than a loop of `useQuery`, because the number of departments is not
   * known at compile time and varies per user (four for an Officer here, one for a
   * Supervisor). Each card resolves independently, so one slow department does not hold up
   * the rest.
   */
  const summaryQueries = useQueries({
    queries: available.map((department) => ({
      queryKey: queryKeys.departments.summary(department.id),
      queryFn: () => getDepartmentSummary(department.id, scope),
      enabled: scope.departmentIds.length > 0,
    })),
  });

  const summaries = useMemo(
    () =>
      available.map((department, index) => ({
        department,
        // A card renders as soon as its own query resolves; until then the counts read zero
        // rather than blocking the whole grid. `isPending` distinguishes "still counting"
        // from "counted, and the answer is zero".
        summary: summaryQueries[index]?.data,
        isPending: summaryQueries[index]?.isPending ?? true,
      })),
    [available, summaryQueries],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return summaries;
    return summaries.filter(
      ({ department }) =>
        department.name.toLowerCase().includes(term) ||
        department.code.toLowerCase().includes(term),
    );
  }, [summaries, search]);

  const choose = (departmentId: string) => {
    selectDepartment(departmentId);
    setLocation(registeredRoutes.dashboard);
  };

  return (
    <div className="space-y-6">
      {current ? (
        <Button variant="ghost" size="sm" onClick={() => setLocation(registeredRoutes.dashboard)}>
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to {current.code}{' '}
          dashboard
        </Button>
      ) : null}

      <PageHeader
        title="Select a department"
        description="Choose the department you want to work in. Every list, count, and report is scoped to it."
      />

      {available.length > 6 ? (
        <SearchBar
          value={search}
          placeholder="Search by name or code…"
          onSearch={setSearch}
          className="max-w-full sm:w-80"
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            available.length === 0 ? 'No departments assigned' : 'No department matches your search'
          }
          description={
            available.length === 0
              ? 'Your account has no authorized departments. Contact the plant maintenance operator.'
              : 'Try a different name or department code.'
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ department, summary, isPending }) => (
            <li key={department.id}>
              <button
                type="button"
                onClick={() => choose(department.id)}
                className="flex w-full flex-col rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="mb-3 flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-bold text-primary">
                      {department.code}
                    </span>
                    <span className="mt-1 block truncate font-semibold">{department.name}</span>
                  </span>
                  <ChevronRight
                    size={18}
                    className="mt-1 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Machines</dt>
                    <dd className="font-medium">{cell(summary?.total, isPending)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Active</dt>
                    <dd className="font-medium">{cell(summary?.active, isPending)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Maint.</dt>
                    <dd className="font-medium">{cell(summary?.underMaintenance, isPending)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Repair</dt>
                    <dd className="font-medium">{cell(summary?.underRepair, isPending)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Due {DUE_SOON_WINDOW_DAYS}d</dt>
                    <dd className="font-medium">{cell(summary?.dueSoon, isPending)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Overdue</dt>
                    <dd
                      className={
                        (summary?.overdue ?? 0) > 0 ? 'font-semibold text-red-600' : 'font-medium'
                      }
                    >
                      {cell(summary?.overdue, isPending)}
                    </dd>
                  </div>
                </dl>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
