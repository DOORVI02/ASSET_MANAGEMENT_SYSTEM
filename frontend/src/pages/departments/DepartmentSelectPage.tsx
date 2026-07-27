import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/shared/SearchBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { registeredRoutes } from '@/lib/routes';

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
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');

  const summaries = useMemo(
    () =>
      available.map((department) => ({
        department,
        summary: repository.getDepartmentSummary(department.id, scope),
      })),
    [available, repository, scope],
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
          {filtered.map(({ department, summary }) => (
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
                    <dd className="font-medium">{summary.total}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Active</dt>
                    <dd className="font-medium">{summary.active}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Maint.</dt>
                    <dd className="font-medium">{summary.underMaintenance}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Repair</dt>
                    <dd className="font-medium">{summary.underRepair}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Due {DUE_SOON_WINDOW_DAYS}d</dt>
                    <dd className="font-medium">{summary.dueSoon}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Overdue</dt>
                    <dd
                      className={summary.overdue > 0 ? 'font-semibold text-red-600' : 'font-medium'}
                    >
                      {summary.overdue}
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
