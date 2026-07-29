import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearch } from 'wouter';
import { ChevronDown, ChevronUp, Eye, Filter, Package, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListToolbar } from '@/components/shared/ListToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import { ResponsiveRecordList } from '@/components/shared/ResponsiveRecordList';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { getPartsSummary, listAllPartsInScope } from '@/lib/supabase/parts';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { partLifeState, replacementDueDate } from '@/lib/part-life';
import { DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { formatDate } from '@/lib/utils';
import { partDetailPath, partsPath, registeredRoutes } from '@/lib/routes';
import type { MachinePart, PartLifeState } from '@/lib/types';

type SortColumn = 'partCode' | 'partName' | 'machineCode';

const lifeFilterValues = ['ok', 'due_soon', 'overdue', 'unknown'] as const;

function parseLifeFilters(raw: string | null): PartLifeState[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is PartLifeState =>
      (lifeFilterValues as readonly string[]).includes(value),
    );
}

export default function PartsPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const lifeFilters = useMemo(() => parseLifeFilters(params.get('life')), [params]);
  const machineFilter = useMemo(() => params.get('machine'), [params]);
  const categoryFilters = useMemo(() => {
    const raw = params.get('category');
    return raw ? raw.split(',').map((value) => value.trim()) : [];
  }, [params]);

  const canWrite = can(user, 'parts:add');

  const departmentId = current?.id;
  const enabled = Boolean(departmentId) && scope.departmentIds.length > 0;

  /**
   * The whole department's parts, because this screen filters on `partLifeState` — a value
   * derived from a fitted date and an expected life, not a stored column the server can
   * filter by. See `fetchAllPages`.
   */
  const {
    data: allParts = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.parts.all(departmentId ?? ''), 'list'],
    queryFn: () => listAllPartsInScope(scope, departmentId),
    enabled,
  });

  const { data: summary = { total: 0, machinesWithParts: 0, categories: 0, dueSoon: 0, overdue: 0 } } =
    useQuery({
      queryKey: queryKeys.parts.summary(departmentId ?? ''),
      queryFn: () => getPartsSummary(departmentId ?? '', scope),
      enabled,
    });

  const categories = useMemo(
    () => Array.from(new Set(allParts.map((part) => part.category))).sort(),
    [allParts],
  );

  const machines = useMemo(
    () =>
      Array.from(
        new Map(allParts.map((part) => [part.machineId, part.machineCode])).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [allParts],
  );

  const applyFilters = (next: {
    life?: PartLifeState[];
    machine?: string | null;
    category?: string[];
  }) => {
    setCurrentPage(1);
    setLocation(
      partsPath({
        life: (next.life ?? lifeFilters).join(',') || undefined,
        machine: (next.machine === undefined ? machineFilter : next.machine) ?? undefined,
        category: (next.category ?? categoryFilters).join(',') || undefined,
      }),
      { replace: true },
    );
  };

  const toggleLife = (state: PartLifeState) =>
    applyFilters({
      life: lifeFilters.includes(state)
        ? lifeFilters.filter((candidate) => candidate !== state)
        : [...lifeFilters, state],
    });

  const toggleCategory = (category: string) =>
    applyFilters({
      category: categoryFilters.includes(category)
        ? categoryFilters.filter((candidate) => candidate !== category)
        : [...categoryFilters, category],
    });

  const clearFilters = () => {
    setSearch('');
    setCurrentPage(1);
    setLocation(partsPath(), { replace: true });
  };

  const filtered = useMemo(() => {
    let result = [...allParts];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (part) =>
          part.partCode.toLowerCase().includes(term) ||
          part.partName.toLowerCase().includes(term) ||
          (part.serialNumber ?? '').toLowerCase().includes(term) ||
          part.machineCode.toLowerCase().includes(term),
      );
    }

    if (machineFilter) {
      result = result.filter((part) => part.machineId === machineFilter);
    }

    if (categoryFilters.length > 0) {
      result = result.filter((part) => categoryFilters.includes(part.category));
    }

    if (lifeFilters.length > 0) {
      result = result.filter((part) => lifeFilters.includes(partLifeState(part)));
    }

    if (sortColumn) {
      const mult = sortDirection === 'asc' ? 1 : -1;
      result = [...result].sort(
        (a, b) =>
          a[sortColumn].localeCompare(b[sortColumn]) * mult || a.partCode.localeCompare(b.partCode),
      );
    }

    return result;
  }, [allParts, search, machineFilter, categoryFilters, lifeFilters, sortColumn, sortDirection]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const activeFilterCount =
    lifeFilters.length + categoryFilters.length + (machineFilter ? 1 : 0) + (search ? 1 : 0);

  const machineCodeFor = (machineId: string) =>
    machines.find(([id]) => id === machineId)?.[1] ?? machineId;

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Installed Parts" description="No department is selected." />
        <EmptyState
          title="Select a department first"
          description="Parts are scoped to one department. Choose one to continue."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installed Parts"
        description={`Components fitted to machinery in ${current.name} (${current.code}).`}
        actions={
          canWrite && (
            <Link href={registeredRoutes.partAdd}>
              <Button>
                <Plus size={16} className="mr-2" aria-hidden="true" />
                Fit part
              </Button>
            </Link>
          )
        }
      />

      {/* Summary cards */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryCard label="Installed parts" value={summary.total} />
        <SummaryCard label="Machines covered" value={summary.machinesWithParts} />
        <SummaryCard label="Categories" value={summary.categories} />
        <SummaryCard
          label={`Due in ${DUE_SOON_WINDOW_DAYS}d`}
          value={summary.dueSoon}
          accent={summary.dueSoon > 0 ? 'text-amber-600' : undefined}
        />
        <SummaryCard
          label="Replacement overdue"
          value={summary.overdue}
          accent={summary.overdue > 0 ? 'text-red-600' : undefined}
        />
      </dl>

      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search code, name, serial, or machine…"
        filters={
          <Button variant="outline" size="sm" onClick={() => setFilterOpen(!filterOpen)}>
            <Filter size={16} className="mr-2" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        }
        summary={
          <span className="text-sm font-medium text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {/* Active filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
          Department: {current.code}
        </span>

        {machineFilter ? (
          <button
            type="button"
            onClick={() => applyFilters({ machine: null })}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
          >
            Machine: {machineCodeFor(machineFilter)}
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove machine filter</span>
          </button>
        ) : null}

        {categoryFilters.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => toggleCategory(category)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
          >
            {category}
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove {category} filter</span>
          </button>
        ))}

        {lifeFilters.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => toggleLife(state)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
          >
            {state.replace(/_/g, ' ')}
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove {state.replace(/_/g, ' ')} filter</span>
          </button>
        ))}
      </div>

      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Replacement state</h4>
              <div className="space-y-2">
                {lifeFilterValues.map((state) => (
                  <label key={state} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={lifeFilters.includes(state)}
                      onCheckedChange={() => toggleLife(state)}
                    />
                    <StatusBadge status={state} />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Category</h4>
              <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto overscroll-contain">
                {categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No categories in this department.</p>
                ) : (
                  categories.map((category) => (
                    <label key={category} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={categoryFilters.includes(category)}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Machine</h4>
              <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto overscroll-contain">
                {machines.map(([machineId, machineCode]) => (
                  <label key={machineId} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={machineFilter === machineId}
                      onCheckedChange={() =>
                        applyFilters({ machine: machineFilter === machineId ? null : machineId })
                      }
                    />
                    <span className="font-mono text-sm">{machineCode}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* "No parts yet" is a real, expected state with its own call to action; a failed
          fetch is not, and must offer a retry rather than imply the department has none. */}
      {isPending ? (
        <LoadingState label="Loading parts…" />
      ) : isError ? (
        <ErrorState
          title="Could not load installed parts"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
        <ResponsiveRecordList
          isEmpty={filtered.length === 0}
          table={
            <table className="w-full">
              <caption className="sr-only">
                Installed parts in {current.name}, {filtered.length} matching
              </caption>
              <thead className="bg-muted/30">
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <SortableHeader
                    label="Part code"
                    column="partCode"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Part name"
                    column="partName"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Machine"
                    column="machineCode"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <th scope="col" className="px-4 py-3">
                    Position
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fitted
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Replacement
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((part) => (
                  <tr key={part.id} className="transition-colors hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono text-sm font-semibold">{part.partCode}</td>
                    <td className="px-4 py-3 font-medium">{part.partName}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                      {part.machineCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {part.positionOnMachine}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {part.quantity} {part.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(part.fittedDate)}
                    </td>
                    <td className="px-4 py-3">
                      <PartLifeCell part={part} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={partDetailPath(part.id)}>
                        <Button variant="ghost" size="sm">
                          <Eye size={14} aria-hidden="true" />
                          <span className="sr-only">View {part.partCode}</span>
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={paginated.map((part) => (
            <div key={part.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={partDetailPath(part.id)}
                    className="font-mono text-sm font-bold text-primary hover:underline"
                  >
                    {part.partCode}
                  </Link>
                  <p className="mt-1 font-medium">{part.partName}</p>
                </div>
                <StatusBadge status={partLifeState(part)} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Machine</dt>
                  <dd className="font-mono font-medium">{part.machineCode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quantity</dt>
                  <dd className="font-medium">
                    {part.quantity} {part.unit}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="font-medium">{part.positionOnMachine}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Fitted</dt>
                  <dd className="font-medium">{formatDate(part.fittedDate)}</dd>
                </div>
              </dl>
              <Link href={partDetailPath(part.id)} className="mt-3 block">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye size={14} className="mr-2" aria-hidden="true" /> View
                </Button>
              </Link>
            </div>
          ))}
        />

        {filtered.length === 0 &&
          (activeFilterCount > 0 ? (
            <EmptyState
              icon={Package}
              title="No parts found"
              description="No installed part matches the current search and filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No parts recorded"
              description={`No components are recorded against machinery in ${current.name} yet.`}
              action={
                canWrite && (
                  <Link href={registeredRoutes.partAdd}>
                    <Button>
                      <Plus size={16} className="mr-2" aria-hidden="true" /> Fit part
                    </Button>
                  </Link>
                )
              }
            />
          ))}

        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        </>
      )}

    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold ${accent ?? 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

function PartLifeCell({ part }: { part: MachinePart }) {
  const due = replacementDueDate(part);
  return (
    <div className="flex flex-col gap-1">
      <StatusBadge status={partLifeState(part)} />
      {due ? <span className="text-xs text-muted-foreground">due {formatDate(due)}</span> : null}
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: SortColumn) => void;
}) {
  return (
    <th
      scope="col"
      className="px-4 py-3"
      aria-sort={
        sortColumn === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        onClick={() => onSort(column)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}{' '}
        {sortColumn === column &&
          (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
    </th>
  );
}
