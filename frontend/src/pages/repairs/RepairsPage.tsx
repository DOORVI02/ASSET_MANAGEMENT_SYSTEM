import { useMemo, useState } from 'react';
import { AlertTriangle, Filter, Plus, X } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListToolbar } from '@/components/shared/ListToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { ResponsiveRecordList } from '@/components/shared/ResponsiveRecordList';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { repairDetailPath, repairsPath, registeredRoutes } from '@/lib/routes';
import { formatDate } from '@/lib/utils';
import { repairStatusLabels } from '@/lib/repair-record';
import { useDepartment } from '@/hooks/use-department';
import { useQuery } from '@tanstack/react-query';
import { getRepairSummary, listAllRepairsInScope } from '@/lib/supabase/repairs';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { RepairRecord, RepairStatus } from '@/lib/types';

const statuses: RepairStatus[] = [
  'reported',
  'in_progress',
  'waiting_for_parts',
  'completed',
  'cancelled',
];

/** Which of a repair's three lifecycle dates the from/to range filters against. */
type RepairDateField = 'reported' | 'started' | 'completed';
const dateFieldLabels: Record<RepairDateField, string> = {
  reported: 'Reported',
  started: 'Started',
  completed: 'Completed',
};

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold ${accent ?? ''}`}>{value}</dd>
    </div>
  );
}

export default function RepairsPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'reported_desc' | 'reported_asc' | 'downtime_desc'>(
    'reported_desc',
  );
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const statusFilters = useMemo(
    () =>
      params
        .get('status')
        ?.split(',')
        .filter((value): value is RepairStatus => statuses.includes(value as RepairStatus)) ?? [],
    [params],
  );
  const machineFilter = params.get('machine');
  const assigneeFilter = params.get('assignee');
  const dateFieldParam = params.get('dateField');
  const dateField: RepairDateField =
    dateFieldParam === 'started' || dateFieldParam === 'completed' ? dateFieldParam : 'reported';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const downtime = params.get('downtime') === 'recorded';
  const departmentId = current?.id;
  const enabled = Boolean(departmentId) && scope.departmentIds.length > 0;

  const {
    data: records = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.repairs.all(departmentId ?? ''), 'list'],
    queryFn: () => listAllRepairsInScope(scope, departmentId),
    enabled,
  });
  const { data: summary = {
            reported: 0,
            inProgress: 0,
            waitingForParts: 0,
            completed: 0,
            cancelled: 0,
            downtimeHours: 0,
          } } = useQuery({
    queryKey: queryKeys.repairs.summary(departmentId ?? ''),
    queryFn: () => getRepairSummary(departmentId ?? '', scope),
    enabled,
  });
  const machines = useMemo(
    () =>
      Array.from(new Map(records.map((record) => [record.machineId, record.machineCode]))).sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [records],
  );
  const assignees = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.assignedTo)
            .filter((assignee): assignee is string => Boolean(assignee)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [records],
  );
  const apply = (
    next: Partial<{
      status: RepairStatus[];
      machine: string | null;
      assignee: string | null;
      dateField: 'reported' | 'started' | 'completed';
      from: string;
      to: string;
      downtime: boolean;
    }>,
  ) => {
    setPage(1);
    setLocation(
      repairsPath({
        status: (next.status ?? statusFilters).join(',') || undefined,
        machine:
          next.machine === undefined ? (machineFilter ?? undefined) : (next.machine ?? undefined),
        assignee:
          next.assignee === undefined
            ? (assigneeFilter ?? undefined)
            : (next.assignee ?? undefined),
        dateField: next.dateField ?? dateField,
        from: next.from === undefined ? from || undefined : next.from || undefined,
        to: next.to === undefined ? to || undefined : next.to || undefined,
        downtime: (next.downtime ?? downtime) ? 'recorded' : undefined,
      }),
      { replace: true },
    );
  };
  const filtered = records.filter((record) => {
    const term = search.trim().toLowerCase();
    if (
      term &&
      ![
        record.machineCode,
        record.machineName,
        record.description,
        record.reportedBy,
        record.assignedTo ?? '',
      ].some((value) => value.toLowerCase().includes(term))
    )
      return false;
    if (statusFilters.length && !statusFilters.includes(record.status)) return false;
    if (machineFilter && record.machineId !== machineFilter) return false;
    if (assigneeFilter && record.assignedTo !== assigneeFilter) return false;
    const selectedDate =
      dateField === 'reported'
        ? record.reportedDate
        : dateField === 'started'
          ? record.startDate
          : record.completedDate;
    if ((from || to) && !selectedDate) return false;
    if (from && selectedDate && selectedDate.slice(0, 10) < from) return false;
    if (to && selectedDate && selectedDate.slice(0, 10) > to) return false;
    return !downtime || record.downtimeHours !== undefined;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'downtime_desc') return (b.downtimeHours ?? -1) - (a.downtimeHours ?? -1);
    const order = new Date(a.reportedDate).getTime() - new Date(b.reportedDate).getTime();
    return sort === 'reported_asc' ? order : -order;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / 10));
  const shown = sorted.slice((page - 1) * 10, page * 10);
  const toggleStatus = (status: RepairStatus) =>
    apply({
      status: statusFilters.includes(status)
        ? statusFilters.filter((candidate) => candidate !== status)
        : [...statusFilters, status],
    });
  const activeFilterCount =
    statusFilters.length +
    Number(Boolean(machineFilter)) +
    Number(Boolean(assigneeFilter)) +
    Number(Boolean(from || to)) +
    Number(downtime);
  const removeAll = () => {
    setSearch('');
    setPage(1);
    setLocation(repairsPath(), { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repairs"
        description={
          current
            ? `Report and track repair work for ${current.name}.`
            : 'Select a department to review repairs.'
        }
        actions={
          can(user, 'repair:add') ? (
            <Link href={registeredRoutes.repairAdd}>
              <Button>
                <Plus size={16} className="mr-2" />
                Report repair
              </Button>
            </Link>
          ) : undefined
        }
      />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Reported" value={summary.reported} accent="text-amber-600" />
        <SummaryCard label="In progress" value={summary.inProgress} accent="text-blue-600" />
        <SummaryCard
          label="Waiting parts"
          value={summary.waitingForParts}
          accent="text-amber-600"
        />
        <SummaryCard label="Completed" value={summary.completed} accent="text-emerald-600" />
        <SummaryCard label="Cancelled" value={summary.cancelled} />
        <SummaryCard
          label="Downtime"
          value={`${summary.downtimeHours} h`}
          accent={summary.downtimeHours ? 'text-red-600' : undefined}
        />
      </dl>
      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search machine, fault, reporter, or assignee…"
        filters={
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)}>
            <Filter size={16} className="mr-2" />
            Filters
            {activeFilterCount ? (
              <span className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        }
        summary={
          <span className="text-sm text-muted-foreground">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        }
      />
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(1);
            }}
          >
            <option value="reported_desc">Reported: newest first</option>
            <option value="reported_asc">Reported: oldest first</option>
            <option value="downtime_desc">Downtime: highest first</option>
          </select>
        </label>
      </div>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent className="rounded-lg border bg-card p-4">
          <div className="grid gap-5 md:grid-cols-4">
            <div>
              <h2 className="mb-2 text-sm font-semibold">Status</h2>
              {statuses.map((status) => (
                <label key={status} className="mb-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <StatusBadge status={status} />
                </label>
              ))}
            </div>
            <label className="text-sm font-medium">
              Machine
              <select
                className="mt-2 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={machineFilter ?? ''}
                onChange={(event) => apply({ machine: event.target.value || null })}
              >
                <option value="">All machines</option>
                {machines.map(([id, code]) => (
                  <option key={id} value={id}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Assignee
              <select
                className="mt-2 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={assigneeFilter ?? ''}
                onChange={(event) => apply({ assignee: event.target.value || null })}
              >
                <option value="">All assignees</option>
                {assignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Date filtered
              <select
                className="mt-2 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={dateField}
                onChange={(event) => apply({ dateField: event.target.value as RepairDateField })}
              >
                {(Object.keys(dateFieldLabels) as RepairDateField[]).map((field) => (
                  <option key={field} value={field}>
                    {dateFieldLabels[field]} date
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              {dateFieldLabels[dateField]} from
              <input
                className="mt-2 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                type="date"
                value={from}
                onChange={(event) => apply({ from: event.target.value })}
              />
            </label>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {dateFieldLabels[dateField]} to
                <input
                  className="mt-2 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  type="date"
                  value={to}
                  onChange={(event) => apply({ to: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={downtime}
                  onCheckedChange={() => apply({ downtime: !downtime })}
                />
                Downtime recorded
              </label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {activeFilterCount ? (
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <Button key={status} variant="outline" size="sm" onClick={() => toggleStatus(status)}>
              {repairStatusLabels[status]}
              <X size={14} className="ml-2" />
            </Button>
          ))}
          {machineFilter ? (
            <Button variant="outline" size="sm" onClick={() => apply({ machine: null })}>
              Machine: {machines.find(([id]) => id === machineFilter)?.[1] ?? machineFilter}
              <X size={14} className="ml-2" />
            </Button>
          ) : null}
          {assigneeFilter ? (
            <Button variant="outline" size="sm" onClick={() => apply({ assignee: null })}>
              Assignee: {assigneeFilter}
              <X size={14} className="ml-2" />
            </Button>
          ) : null}
          {from || to ? (
            <Button variant="outline" size="sm" onClick={() => apply({ from: '', to: '' })}>
              {dateFieldLabels[dateField]} {from || '…'} – {to || '…'}
              <X size={14} className="ml-2" />
            </Button>
          ) : null}
          {downtime ? (
            <Button variant="outline" size="sm" onClick={() => apply({ downtime: false })}>
              Downtime recorded
              <X size={14} className="ml-2" />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={removeAll}>
            Clear all
          </Button>
        </div>
      ) : null}
      {isPending ? (
        <LoadingState label="Loading repairs…" />
      ) : isError ? (
        <ErrorState
          title="Could not load repairs"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : shown.length ? (
        <>
            <ResponsiveRecordList
              table={
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Repair records, {shown.length} shown on this page
                  </caption>
                  <thead className="bg-muted/30">
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-4 py-3">
                        Machine
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Problem
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Reported
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Assignee
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Downtime
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((record) => (
                      <RepairRow key={record.id} record={record} />
                    ))}
                  </tbody>
                </table>
              }
              cards={shown.map((record) => (
                <Link
                  key={record.id}
                  href={repairDetailPath(record.id)}
                  className="block rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{record.machineCode}</p>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Reported {formatDate(record.reportedDate)} · {record.downtimeHours ?? 0} h
                    downtime
                  </p>
                </Link>
              ))}
            />
            <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="No repair records match"
            description="Try clearing a filter or report a new repair for this department."
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={removeAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
      )}

    </div>
  );
}

function RepairRow({ record }: { record: RepairRecord }) {
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="p-3">
        <Link
          className="font-medium text-primary hover:underline"
          href={repairDetailPath(record.id)}
        >
          {record.machineCode}
        </Link>
        <p className="text-xs text-muted-foreground">{record.machineName}</p>
      </td>
      <td className="max-w-xs p-3">
        <p className="line-clamp-2">{record.description}</p>
      </td>
      <td className="p-3">
        <StatusBadge status={record.status} />
      </td>
      <td className="p-3">{formatDate(record.reportedDate)}</td>
      <td className="p-3">{record.assignedTo ?? 'Unassigned'}</td>
      <td className="p-3">
        {record.downtimeHours === undefined ? '—' : `${record.downtimeHours} h`}
      </td>
    </tr>
  );
}
