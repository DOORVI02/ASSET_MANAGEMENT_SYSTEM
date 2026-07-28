import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CalendarPlus, ChevronDown, ChevronUp, Eye, Filter, Plus, Wrench, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListToolbar } from '@/components/shared/ListToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import { ResponsiveRecordList } from '@/components/shared/ResponsiveRecordList';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { maintenanceDueState } from '@/lib/maintenance-record';
import { planDueState, planNextDueDate, formatInterval } from '@/lib/maintenance-plan';
import { DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { formatDate } from '@/lib/utils';
import {
  maintenanceDetailPath,
  maintenancePath,
  maintenancePlanEditPath,
  registeredRoutes,
} from '@/lib/routes';
import type { DueState, MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '@/lib/types';

type SortColumn = 'scheduledDate' | 'machineCode' | 'type';

const statusValues: MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const typeValues: MaintenanceType[] = [
  'preventive',
  'corrective',
  'inspection',
  'lubrication',
  'calibration',
  'emergency',
];
const dueFilterValues = ['due_soon', 'overdue'] as const;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const activeTab = params.get('view') === 'plans' ? 'plans' : 'records';
  const statusFilters = useMemo(() => {
    const raw = params.get('status');
    if (!raw) return [];
    const allowed = new Set<string>(statusValues);
    return raw.split(',').filter((value) => allowed.has(value)) as MaintenanceStatus[];
  }, [params]);
  const typeFilters = useMemo(() => {
    const raw = params.get('type');
    if (!raw) return [];
    const allowed = new Set<string>(typeValues);
    return raw.split(',').filter((value) => allowed.has(value)) as MaintenanceType[];
  }, [params]);
  const dueFilter = useMemo(() => {
    const raw = params.get('due');
    return raw === 'soon' || raw === 'overdue' ? raw : null;
  }, [params]);
  const machineFilter = useMemo(() => params.get('machine'), [params]);

  const canWrite = can(user, 'maintenance:add');

  const records = useMemo(
    () => (current ? repository.listMaintenanceForDepartment(current.id, scope) : []),
    [current, repository, scope],
  );
  const plans = useMemo(
    () => (current ? repository.listMaintenancePlansForDepartment(current.id, scope) : []),
    [current, repository, scope],
  );
  const summary = useMemo(
    () =>
      current
        ? repository.getMaintenanceSummary(current.id, scope)
        : { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, dueSoon: 0, overdue: 0 },
    [current, repository, scope],
  );

  const machines = useMemo(
    () =>
      Array.from(new Map(records.map((r) => [r.machineId, r.machineCode])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [records],
  );

  const applyFilters = (next: {
    status?: MaintenanceStatus[];
    type?: MaintenanceType[];
    due?: 'soon' | 'overdue' | null;
    machine?: string | null;
  }) => {
    setCurrentPage(1);
    setLocation(
      maintenancePath({
        view: activeTab,
        status: (next.status ?? statusFilters).join(',') || undefined,
        type: (next.type ?? typeFilters).join(',') || undefined,
        due: (next.due === undefined ? dueFilter : next.due) ?? undefined,
        machine: (next.machine === undefined ? machineFilter : next.machine) ?? undefined,
      }),
      { replace: true },
    );
  };

  const setTab = (tab: string) =>
    setLocation(maintenancePath({ view: tab as 'records' | 'plans' }));

  const toggleStatus = (status: MaintenanceStatus) =>
    applyFilters({
      status: statusFilters.includes(status)
        ? statusFilters.filter((s) => s !== status)
        : [...statusFilters, status],
    });

  const toggleType = (type: MaintenanceType) =>
    applyFilters({
      type: typeFilters.includes(type)
        ? typeFilters.filter((t) => t !== type)
        : [...typeFilters, type],
    });

  const toggleDue = (state: 'soon' | 'overdue') =>
    applyFilters({ due: dueFilter === state ? null : state });

  const clearFilters = () => {
    setSearch('');
    setCurrentPage(1);
    setLocation(maintenancePath({ view: activeTab }), { replace: true });
  };

  const dueStateOf = (record: MaintenanceRecord): DueState => maintenanceDueState(record);

  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.machineCode.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.technicianName.toLowerCase().includes(term),
      );
    }
    if (statusFilters.length > 0) result = result.filter((r) => statusFilters.includes(r.status));
    if (typeFilters.length > 0) result = result.filter((r) => typeFilters.includes(r.type));
    if (machineFilter) result = result.filter((r) => r.machineId === machineFilter);
    if (dueFilter === 'soon') result = result.filter((r) => dueStateOf(r) === 'due_soon');
    if (dueFilter === 'overdue') result = result.filter((r) => dueStateOf(r) === 'overdue');

    if (sortColumn) {
      const mult = sortDirection === 'asc' ? 1 : -1;
      result = result.sort((a, b) => {
        if (sortColumn === 'scheduledDate') {
          return (new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()) * mult;
        }
        return a[sortColumn].localeCompare(b[sortColumn]) * mult;
      });
    }

    return result;
  }, [
    records,
    search,
    statusFilters,
    typeFilters,
    machineFilter,
    dueFilter,
    sortColumn,
    sortDirection,
  ]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const activeFilterCount =
    statusFilters.length +
    typeFilters.length +
    (dueFilter ? 1 : 0) +
    (machineFilter ? 1 : 0) +
    (search ? 1 : 0);

  const machineCodeFor = (machineId: string) =>
    machines.find(([id]) => id === machineId)?.[1] ?? machineId;

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Maintenance" description="No department is selected." />
        <EmptyState
          title="Select a department first"
          description="Maintenance is scoped to one department. Choose one to continue."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description={`Schedule, history, and recurring plans for ${current.name} (${current.code}).`}
        actions={
          canWrite && (
            <div className="flex gap-2">
              <Link href={registeredRoutes.maintenancePlanAdd}>
                <Button variant="outline">
                  <CalendarPlus size={16} className="mr-2" aria-hidden="true" />
                  New plan
                </Button>
              </Link>
              <Link href={registeredRoutes.maintenanceAdd}>
                <Button>
                  <Plus size={16} className="mr-2" aria-hidden="true" />
                  Log maintenance
                </Button>
              </Link>
            </div>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <SummaryCard label="Scheduled" value={summary.scheduled} />
        <SummaryCard label="In progress" value={summary.inProgress} accent="text-blue-600" />
        <SummaryCard
          label={`Due in ${DUE_SOON_WINDOW_DAYS}d`}
          value={summary.dueSoon}
          accent={summary.dueSoon > 0 ? 'text-amber-600' : undefined}
        />
        <SummaryCard
          label="Overdue"
          value={summary.overdue}
          accent={summary.overdue > 0 ? 'text-red-600' : undefined}
        />
        <SummaryCard label="Completed" value={summary.completed} accent="text-emerald-600" />
        <SummaryCard label="Cancelled" value={summary.cancelled} />
      </dl>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6 space-y-6">
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search machine, description, or technician…"
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
                {filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}
              </span>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
              Department: {current.code}
            </span>
            {statusFilters.map((status) => (
              <Chip key={status} label={titleCase(status)} onRemove={() => toggleStatus(status)} />
            ))}
            {typeFilters.map((type) => (
              <Chip key={type} label={titleCase(type)} onRemove={() => toggleType(type)} />
            ))}
            {machineFilter ? (
              <Chip
                label={`Machine: ${machineCodeFor(machineFilter)}`}
                onRemove={() => applyFilters({ machine: null })}
              />
            ) : null}
            {dueFilter ? (
              <Chip
                label={dueFilter === 'soon' ? `Due within ${DUE_SOON_WINDOW_DAYS} days` : 'Overdue'}
                onRemove={() => toggleDue(dueFilter)}
              />
            ) : null}
          </div>

          <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
            <CollapsibleContent className="rounded-lg border bg-card p-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Status</h4>
                  <div className="space-y-2">
                    {statusValues.map((status) => (
                      <label key={status} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={statusFilters.includes(status)}
                          onCheckedChange={() => toggleStatus(status)}
                        />
                        <StatusBadge status={status} />
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Due state</h4>
                  <div className="space-y-2">
                    {dueFilterValues.map((state) => (
                      <label key={state} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={dueFilter === (state === 'due_soon' ? 'soon' : 'overdue')}
                          onCheckedChange={() =>
                            toggleDue(state === 'due_soon' ? 'soon' : 'overdue')
                          }
                        />
                        <span className="text-sm">
                          {state === 'due_soon'
                            ? `Due within ${DUE_SOON_WINDOW_DAYS} days`
                            : 'Overdue'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">Type</h4>
                  <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto overscroll-contain">
                    {typeValues.map((type) => (
                      <label key={type} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={typeFilters.includes(type)}
                          onCheckedChange={() => toggleType(type)}
                        />
                        <span className="text-sm">{titleCase(type)}</span>
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

          <ResponsiveRecordList
            isEmpty={filteredRecords.length === 0}
            table={
              <table className="w-full">
                <caption className="sr-only">
                  Maintenance records in {current.name}, {filteredRecords.length} matching
                </caption>
                <thead className="bg-muted/30">
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <SortableHeader
                      label="Scheduled"
                      column="scheduledDate"
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
                    <SortableHeader
                      label="Type"
                      column="type"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Technician
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Due state
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((record) => (
                    <tr key={record.id} className="transition-colors hover:bg-muted/10">
                      <td className="px-4 py-3 text-sm">{formatDate(record.scheduledDate)}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold">
                        {record.machineCode}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize">{record.type}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {record.technicianName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={dueStateOf(record)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={maintenanceDetailPath(record.id)}>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} aria-hidden="true" />
                            <span className="sr-only">
                              View maintenance on {record.machineCode}
                            </span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
            cards={paginated.map((record) => (
              <div key={record.id} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={maintenanceDetailPath(record.id)}
                      className="font-mono text-sm font-bold text-primary hover:underline"
                    >
                      {record.machineCode}
                    </Link>
                    <p className="mt-1 text-sm font-medium capitalize">{record.type}</p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Scheduled</dt>
                    <dd className="font-medium">{formatDate(record.scheduledDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Technician</dt>
                    <dd className="font-medium">{record.technicianName}</dd>
                  </div>
                </dl>
                <div className="mt-2">
                  <StatusBadge status={dueStateOf(record)} />
                </div>
                <Link href={maintenanceDetailPath(record.id)} className="mt-3 block">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye size={14} className="mr-2" aria-hidden="true" /> View
                  </Button>
                </Link>
              </div>
            ))}
          />

          {filteredRecords.length === 0 &&
            (activeFilterCount > 0 ? (
              <EmptyState
                icon={Wrench}
                title="No maintenance records found"
                description="No record matches the current search and filters."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Wrench}
                title="No maintenance recorded"
                description={`No maintenance has been scheduled or logged in ${current.name} yet.`}
                action={
                  canWrite && (
                    <Link href={registeredRoutes.maintenanceAdd}>
                      <Button>
                        <Plus size={16} className="mr-2" aria-hidden="true" /> Log maintenance
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
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-4">
          {plans.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No recurring plans"
              description={`No recurring maintenance plans are defined in ${current.name} yet.`}
              action={
                canWrite && (
                  <Link href={registeredRoutes.maintenancePlanAdd}>
                    <Button>
                      <CalendarPlus size={16} className="mr-2" aria-hidden="true" /> New plan
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <ResponsiveRecordList
              table={
                <table className="w-full">
                  <caption className="sr-only">
                    Recurring maintenance plans in {current.name}
                  </caption>
                  <thead className="bg-muted/30">
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-4 py-3">
                        Machine
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Type
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Interval
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Next due
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plans.map((plan) => (
                      <tr key={plan.id} className="transition-colors hover:bg-muted/10">
                        <td className="px-4 py-3 font-mono text-sm font-semibold">
                          {plan.machineCode}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{plan.type}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatInterval(plan.intervalValue, plan.intervalUnit)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {plan.isActive && !plan.isArchived
                            ? formatDate(planNextDueDate(plan))
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              plan.isArchived
                                ? 'cancelled'
                                : !plan.isActive
                                  ? 'inactive'
                                  : planDueState(plan)
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canWrite ? (
                            <Link href={maintenancePlanEditPath(plan.id)}>
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          )}
        </TabsContent>
      </Tabs>
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

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
    >
      {label}
      <X size={12} aria-hidden="true" />
      <span className="sr-only">Remove {label} filter</span>
    </button>
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
