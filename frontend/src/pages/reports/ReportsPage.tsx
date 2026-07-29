import { isValidElement, useMemo, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  Download,
  FileText,
  Package,
  Settings2,
  Timer,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ResponsiveRecordList } from '@/components/shared/ResponsiveRecordList';
import { SearchBar } from '@/components/shared/SearchBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQueries, useQuery } from '@tanstack/react-query';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listAllMaintenanceInScope } from '@/lib/supabase/maintenance';
import { listAllRepairsInScope } from '@/lib/supabase/repairs';
import { listAllPartsInScope } from '@/lib/supabase/parts';
import { getDepartmentSummary } from '@/lib/supabase/departments';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import { isDueSoon, isOverdue, DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { maintenanceDueState } from '@/lib/maintenance-record';
import { partLifeState } from '@/lib/part-life';
import { cn, formatDate } from '@/lib/utils';
import { reportsPath } from '@/lib/routes';
import type { LucideIcon } from 'lucide-react';

interface ReportRow {
  key: string;
  cells: ReactNode[];
  /** Lower-cased text the search filter matches against. */
  search: string;
  /** The row's date, when the report has a date dimension to filter on. */
  date?: string;
}

interface ReportTable {
  columns: string[];
  rows: ReportRow[];
  /** Names the from/to range so it is never ambiguous which date is filtered. */
  dateLabel?: string;
}

/**
 * Flattens a rendered cell back to text for export.
 *
 * Most cells are already strings or numbers. Status cells are `<StatusBadge>` elements, whose
 * `status` prop is the underlying value — reading it keeps the export in step with the table
 * automatically, rather than duplicating each report's data shaping a second time just for
 * CSV, where the two could drift apart.
 */
function cellText(cell: ReactNode): string {
  if (cell === null || cell === undefined || typeof cell === 'boolean') return '';
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  if (isValidElement<{ status?: string }>(cell) && typeof cell.props.status === 'string') {
    return cell.props.status.replace(/_/g, ' ');
  }
  return '';
}

/** RFC 4180 quoting: a field containing a comma, quote or newline must be quoted, and its own quotes doubled. */
function toCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

type ReportId =
  | 'machine-register'
  | 'department-assets'
  | 'maintenance-history'
  | 'due-overdue'
  | 'repair-history'
  | 'downtime'
  | 'machine-parts';

interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Officer-only reports cross department boundaries, which a Supervisor never may. */
  officerOnly?: boolean;
}

const reportDefinitions: ReportDefinition[] = [
  {
    id: 'machine-register',
    title: 'Machine register',
    description: 'Every machine in the current department with status, location, and next service.',
    icon: Settings2,
  },
  {
    id: 'department-assets',
    title: 'Department assets',
    description: 'Machine counts per department across your authorized scope.',
    icon: Building2,
    officerOnly: true,
  },
  {
    id: 'maintenance-history',
    title: 'Maintenance history',
    description: 'All maintenance records with type, status, technician, and dates.',
    icon: Wrench,
  },
  {
    id: 'due-overdue',
    title: 'Due and overdue maintenance',
    description: `Open records inside the ${DUE_SOON_WINDOW_DAYS}-day window or already past due.`,
    icon: CalendarClock,
  },
  {
    id: 'repair-history',
    title: 'Repair history',
    description: 'Reported repairs with status, assignee, and resolution dates.',
    icon: AlertTriangle,
  },
  {
    id: 'downtime',
    title: 'Downtime',
    description: 'Recorded downtime hours per machine, highest first.',
    icon: Timer,
  },
  {
    id: 'machine-parts',
    title: 'Installed parts',
    description: 'Components fitted to machines, with position and replacement state.',
    icon: Package,
  },
];

function isReportId(value: string | null): value is ReportId {
  return reportDefinitions.some((definition) => definition.id === value);
}

/** Text a row is searched by. Nodes are excluded, so only plain values are matched. */
function searchable(...values: (string | number | undefined)[]): string {
  return values
    .filter((value) => value !== undefined)
    .join(' ')
    .toLowerCase();
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { current, available, scope } = useDepartment();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const rawReport = params.get('report');
  const selected = isReportId(rawReport) ? rawReport : null;
  // Filters live in the URL, matching the Phase 2D/3/4 pattern: a link, a manual change,
  // refresh, and back navigation all agree.
  const query = params.get('q') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const canExport = can(user, 'reports:export');
  const canSeeCrossDepartment = can(user, 'reports:officer_only');

  const visibleReports = useMemo(
    () => reportDefinitions.filter((report) => !report.officerOnly || canSeeCrossDepartment),
    [canSeeCrossDepartment],
  );

  // A Supervisor reaching an Officer-only report by URL is refused rather than served,
  // matching the department-scoping rule: the UI never widens what the role may read.
  const selectedDefinition = useMemo(
    () => visibleReports.find((report) => report.id === selected) ?? null,
    [visibleReports, selected],
  );

  const departmentId = current?.id;
  const enabled = Boolean(departmentId) && scope.departmentIds.length > 0;

  /**
   * Reports aggregate whole datasets — counts, groupings, date ranges across every record
   * in the department — so each one genuinely needs the full set rather than a page of it.
   */
  const { data: machines = [], isPending: machinesPending } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), departmentId ?? '', 'reports'],
    queryFn: () => listAllMachinesInScope(scope, departmentId),
    enabled,
  });
  const { data: maintenance = [], isPending: maintenancePending } = useQuery({
    queryKey: [...queryKeys.maintenance.all(departmentId ?? ''), 'reports'],
    queryFn: () => listAllMaintenanceInScope(scope, departmentId),
    enabled,
  });
  const { data: repairs = [], isPending: repairsPending } = useQuery({
    queryKey: [...queryKeys.repairs.all(departmentId ?? ''), 'reports'],
    queryFn: () => listAllRepairsInScope(scope, departmentId),
    enabled,
  });
  const { data: parts = [], isPending: partsPending } = useQuery({
    queryKey: [...queryKeys.parts.all(departmentId ?? ''), 'reports'],
    queryFn: () => listAllPartsInScope(scope, departmentId),
    enabled,
  });

  // The department-assets report needs one summary per department the user can reach.
  const departmentSummaries = useQueries({
    queries: available.map((department) => ({
      queryKey: queryKeys.departments.summary(department.id),
      queryFn: () => getDepartmentSummary(department.id, scope),
      enabled: scope.departmentIds.length > 0,
    })),
  });
  const summaryByDepartmentId = useMemo(
    () =>
      new Map(
        available.map((department, index) => [department.id, departmentSummaries[index]?.data]),
      ),
    [available, departmentSummaries],
  );

  const reportsPending =
    machinesPending || maintenancePending || repairsPending || partsPending;

  const table = useMemo<ReportTable | null>(() => {
    if (!selectedDefinition) return null;

    switch (selectedDefinition.id) {
      case 'machine-register':
        return {
          columns: ['Code', 'Name', 'Status', 'Location', 'Next maintenance'],
          dateLabel: 'Next maintenance',
          rows: machines.map((machine) => ({
            key: machine.id,
            search: searchable(machine.code, machine.name, machine.location, machine.status),
            date: machine.nextMaintenanceDate,
            cells: [
              machine.code,
              machine.name,
              <StatusBadge key="status" status={machine.status} />,
              machine.location,
              formatDate(machine.nextMaintenanceDate),
            ],
          })),
        };

      case 'department-assets':
        return {
          columns: ['Department', 'Code', 'Machines', 'Due soon', 'Overdue'],
          rows: available.map((department) => {
            // Absent only while that department's summary is still loading; the screen
            // withholds the whole table until then, so zeroes never read as findings.
            const summary = summaryByDepartmentId.get(department.id) ?? {
              total: 0,
              dueSoon: 0,
              overdue: 0,
            };
            return {
              key: department.id,
              search: searchable(department.name, department.code),
              cells: [
                department.name,
                department.code,
                summary.total,
                summary.dueSoon,
                summary.overdue,
              ],
            };
          }),
        };

      case 'maintenance-history':
        return {
          columns: ['Machine', 'Type', 'Status', 'Scheduled', 'Completed', 'Technician'],
          dateLabel: 'Scheduled',
          rows: maintenance.map((record) => ({
            key: record.id,
            search: searchable(
              record.machineCode,
              record.type,
              record.status,
              record.technicianName,
              record.description,
            ),
            date: record.scheduledDate,
            cells: [
              record.machineCode,
              record.type,
              <StatusBadge key="status" status={record.status} />,
              formatDate(record.scheduledDate),
              record.completedDate ? formatDate(record.completedDate) : '—',
              record.technicianName,
            ],
          })),
        };

      case 'due-overdue': {
        // Derived from the same shared window the dashboard and register use, so this
        // report can never disagree with the counts that link to it.
        const open = maintenance.filter((record) => {
          const due = maintenanceDueState(record);
          return due === 'due_soon' || due === 'overdue';
        });
        return {
          columns: ['Machine', 'Type', 'Scheduled', 'Due state', 'Technician'],
          dateLabel: 'Scheduled',
          rows: open.map((record) => ({
            key: record.id,
            search: searchable(record.machineCode, record.type, record.technicianName),
            date: record.scheduledDate,
            cells: [
              record.machineCode,
              record.type,
              formatDate(record.scheduledDate),
              <StatusBadge key="due" status={maintenanceDueState(record)} />,
              record.technicianName,
            ],
          })),
        };
      }

      case 'repair-history':
        return {
          columns: ['Machine', 'Status', 'Reported', 'Completed', 'Assignee', 'Downtime (h)'],
          dateLabel: 'Reported',
          rows: repairs.map((record) => ({
            key: record.id,
            search: searchable(
              record.machineCode,
              record.status,
              record.assignedTo,
              record.description,
            ),
            date: record.reportedDate,
            cells: [
              record.machineCode,
              <StatusBadge key="status" status={record.status} />,
              formatDate(record.reportedDate),
              record.completedDate ? formatDate(record.completedDate) : '—',
              record.assignedTo ?? 'Unassigned',
              record.downtimeHours ?? '—',
            ],
          })),
        };

      case 'downtime': {
        const byMachine = new Map<string, { code: string; name: string; hours: number }>();
        for (const record of repairs) {
          if (!record.downtimeHours) continue;
          const entry = byMachine.get(record.machineId) ?? {
            code: record.machineCode,
            name: record.machineName,
            hours: 0,
          };
          entry.hours += record.downtimeHours;
          byMachine.set(record.machineId, entry);
        }
        const ranked = [...byMachine.entries()].sort((a, b) => b[1].hours - a[1].hours);
        return {
          columns: ['Machine', 'Name', 'Total downtime (h)'],
          rows: ranked.map(([machineId, entry]) => ({
            key: machineId,
            search: searchable(entry.code, entry.name),
            cells: [entry.code, entry.name, entry.hours],
          })),
        };
      }

      case 'machine-parts':
        return {
          columns: ['Part code', 'Part name', 'Machine', 'Position', 'Qty', 'Replacement'],
          dateLabel: 'Fitted',
          rows: parts.map((part) => ({
            key: part.id,
            search: searchable(
              part.partCode,
              part.partName,
              part.machineCode,
              part.positionOnMachine,
              part.category,
            ),
            date: part.fittedDate,
            cells: [
              part.partCode,
              part.partName,
              part.machineCode,
              part.positionOnMachine,
              `${part.quantity} ${part.unit}`,
              <StatusBadge key="life" status={partLifeState(part)} />,
            ],
          })),
        };
    }
  }, [selectedDefinition, machines, maintenance, repairs, parts, available, summaryByDepartmentId]);

  const filteredRows = useMemo(() => {
    if (!table) return [];
    const term = query.trim().toLowerCase();

    return table.rows.filter((row) => {
      if (term && !row.search.includes(term)) return false;
      if (!table.dateLabel) return true;
      // A row with no date cannot satisfy a range, so it drops out once one is set.
      const rowDate = row.date?.slice(0, 10);
      if ((from || to) && !rowDate) return false;
      if (from && rowDate && rowDate < from) return false;
      if (to && rowDate && rowDate > to) return false;
      return true;
    });
  }, [table, query, from, to]);

  const dueCount = useMemo(
    () =>
      machines.filter(
        (machine) =>
          machine.status === 'active' &&
          (isDueSoon(machine.nextMaintenanceDate) || isOverdue(machine.nextMaintenanceDate)),
      ).length,
    [machines],
  );

  const applyFilters = (next: {
    report?: ReportId | null;
    q?: string;
    from?: string;
    to?: string;
  }) => {
    const reportId = next.report === undefined ? selected : next.report;
    if (!reportId) {
      setLocation(reportsPath());
      return;
    }
    setLocation(
      reportsPath({
        report: reportId,
        q: (next.q === undefined ? query : next.q) || undefined,
        from: (next.from === undefined ? from : next.from) || undefined,
        to: (next.to === undefined ? to : next.to) || undefined,
      }),
      { replace: Boolean(next.report === undefined) },
    );
  };

  const selectReport = (reportId: ReportId | null) => {
    // Filters are per-report, so switching reports clears them rather than carrying a
    // date range onto a report whose dates mean something else.
    setLocation(reportId ? reportsPath({ report: reportId }) : reportsPath());
  };

  const clearFilters = () => applyFilters({ q: '', from: '', to: '' });
  const activeFilterCount = (query ? 1 : 0) + (from || to ? 1 : 0);

  const handleExport = () => {
    // `current` is guaranteed by the guard below, but the export closure is defined above it.
    if (!table || !selectedDefinition || !current) return;

    // Exports exactly the rows on screen, filters and all — an export that quietly
    // returned the unfiltered set would disagree with what the user is looking at.
    const csv = [
      table.columns.map(toCsvField).join(','),
      ...filteredRows.map((row) => row.cells.map((cell) => toCsvField(cellText(cell))).join(',')),
    ].join('\r\n');

    // The BOM is what makes Excel read this as UTF-8 rather than the local codepage, which
    // otherwise mangles any non-ASCII text in a machine name or location.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDefinition.id}-${current.code}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success('Report exported', {
      description: `${filteredRows.length} row${filteredRows.length === 1 ? '' : 's'} written to CSV.`,
    });
  };

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="No department is selected." />
        <EmptyState
          title="Select a department first"
          description="Every report is scoped to one department. Choose one to continue."
        />
      </div>
    );
  }

  // A report is an aggregate: a partly-loaded one is not a smaller true answer, it is a
  // wrong one. Nothing renders until every dataset it counts over has arrived.
  if (reportsPending) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description={`Reports for ${current.name} (${current.code}).`} />
        <LoadingState label="Loading report data…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`${current.code} · ${current.name}. Every report below is scoped to this department.`}
        actions={
          selectedDefinition && canExport ? (
            <Button variant="outline" onClick={handleExport}>
              <Download size={16} className="mr-2" aria-hidden="true" />
              Export
            </Button>
          ) : undefined
        }
      />

      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Export produces CSV',
          description:
            'Figures are live from the database. Export writes the rows currently on screen — filters included — as a CSV file. PDF output is not implemented.',
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleReports.map((report) => {
          const isActive = selectedDefinition?.id === report.id;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => selectReport(isActive ? null : report.id)}
              aria-pressed={isActive}
              className={cn(
                'flex h-full flex-col items-start gap-2 rounded-lg border bg-card p-5 text-left shadow-sm transition-all',
                'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive && 'border-primary ring-1 ring-primary',
              )}
            >
              <span className="rounded-full bg-primary/10 p-2.5 text-primary">
                <report.icon size={20} aria-hidden="true" />
              </span>
              <span className="font-semibold text-foreground">{report.title}</span>
              <span className="text-sm text-muted-foreground">{report.description}</span>
            </button>
          );
        })}
      </div>

      {/* An Officer-only report requested by URL under a Supervisor session lands here. */}
      {rawReport && !selectedDefinition ? (
        <EmptyState
          icon={FileText}
          title="Report not available"
          description="That report either does not exist or is outside your role's access. Pick one from the list above."
        />
      ) : null}

      {selectedDefinition && table ? (
        <section aria-labelledby="report-preview-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="report-preview-heading" className="text-lg font-semibold">
                {selectedDefinition.title}
              </h2>
              <p className="text-sm text-muted-foreground" role="status">
                {filteredRows.length} of {table.rows.length}{' '}
                {table.rows.length === 1 ? 'row' : 'rows'}
              </p>
            </div>
            <Link
              href="/machines"
              className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open machine register
            </Link>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm lg:flex-row lg:items-end">
            <div className="flex-1">
              <SearchBar
                value={query}
                placeholder={`Search ${selectedDefinition.title.toLowerCase()}…`}
                onSearch={(value) => applyFilters({ q: value })}
                className="max-w-full lg:w-80"
              />
            </div>

            {table.dateLabel ? (
              <div className="flex flex-wrap gap-3">
                <label className="text-sm font-medium">
                  {table.dateLabel} from
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => applyFilters({ from: event.target.value })}
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="text-sm font-medium">
                  {table.dateLabel} to
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => applyFilters({ to: event.target.value })}
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
            ) : null}
          </div>

          {activeFilterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {query ? (
                <Chip label={`Search: ${query}`} onRemove={() => applyFilters({ q: '' })} />
              ) : null}
              {from || to ? (
                <Chip
                  label={`${table.dateLabel}: ${from || 'any'} → ${to || 'any'}`}
                  onRemove={() => applyFilters({ from: '', to: '' })}
                />
              ) : null}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          ) : null}

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No rows match"
              description={
                activeFilterCount > 0
                  ? 'No row in this report matches the current filters.'
                  : `No rows exist for this report in ${current.name}.`
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ResponsiveRecordList
              table={
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    {selectedDefinition.title} for {current.name}, {filteredRows.length} rows
                  </caption>
                  <thead className="bg-muted/30">
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {table.columns.map((column) => (
                        <th key={column} scope="col" className="whitespace-nowrap px-4 py-3">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRows.map((row) => (
                      <tr key={row.key} className="transition-colors hover:bg-muted/30">
                        {row.cells.map((cell, index) => (
                          <td key={index} className="whitespace-nowrap px-4 py-3">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
              // Below `lg` the same rows are rendered as label/value cards, matching
              // every other list in the app rather than clipping a wide table.
              cards={filteredRows.map((row) => (
                <dl key={row.key} className="rounded-lg border bg-card p-4 shadow-sm">
                  {table.columns.map((column, index) => (
                    <div
                      key={column}
                      className="flex items-start justify-between gap-3 py-1 text-sm"
                    >
                      <dt className="text-muted-foreground">{column}</dt>
                      <dd className="text-right font-medium">{row.cells[index]}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            />
          )}
        </section>
      ) : null}

      {!selectedDefinition && !rawReport ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryTile icon={Settings2} label="Machines in scope" value={machines.length} />
          <SummaryTile icon={BarChart3} label="Maintenance records" value={maintenance.length} />
          <SummaryTile icon={CalendarClock} label="Machines due or overdue" value={dueCount} />
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <X size={12} aria-hidden="true" />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <span className="rounded-full bg-muted p-2.5 text-muted-foreground">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
