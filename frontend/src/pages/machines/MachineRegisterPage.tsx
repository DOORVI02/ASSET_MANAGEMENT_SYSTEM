import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListToolbar } from '@/components/shared/ListToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import { ResponsiveRecordList } from '@/components/shared/ResponsiveRecordList';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { useDepartment } from '@/hooks/use-department';
import { DUE_SOON_WINDOW_DAYS, isDueSoon, isOverdue } from '@/lib/maintenance-window';
import { Link, useLocation, useSearch } from 'wouter';
import { Plus, Filter, Eye, Edit, ChevronDown, ChevronUp, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  machineDetailPath,
  machineEditPath,
  machineRegisterPath,
  registeredRoutes,
} from '@/lib/routes';
import { MachineStatus } from '@/lib/types';

type SortColumn = 'code' | 'name';

const machineStatuses: readonly MachineStatus[] = [
  'active',
  'inactive',
  'under_maintenance',
  'under_repair',
  'retired',
];

function parseStatuses(raw: string | null): MachineStatus[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is MachineStatus =>
      (machineStatuses as readonly string[]).includes(value),
    );
}

export default function MachineRegisterPage() {
  const { user } = useAuth();
  const repository = useMockRepository();
  const { current, available, scope, canChoose } = useDepartment();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // The URL is the single source of truth for status and due filters, so a dashboard
  // drill-down, a manual filter change, refresh, and back navigation all agree.
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const statusFilters = useMemo(() => parseStatuses(params.get('status')), [params]);
  const dueFilter = useMemo<'soon' | 'overdue' | null>(() => {
    const due = params.get('due');
    return due === 'soon' || due === 'overdue' ? due : null;
  }, [params]);

  /**
   * Officers may widen the list across their associated departments. When no department
   * filter is set the list stays scoped to the current department.
   */
  const deptFilters = useMemo(() => {
    const raw = params.get('dept');
    if (!raw) return [];
    const allowed = new Set(available.map((department) => department.id));
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => allowed.has(value));
  }, [params, available]);

  const applyFilters = (next: {
    status?: MachineStatus[];
    due?: 'soon' | 'overdue' | null;
    dept?: string[];
  }) => {
    const status = next.status ?? statusFilters;
    const due = next.due === undefined ? dueFilter : next.due;
    const dept = next.dept ?? deptFilters;
    setCurrentPage(1);
    setLocation(
      machineRegisterPath({
        status: status.length > 0 ? status.join(',') : undefined,
        due: due ?? undefined,
        dept: dept.length > 0 ? dept.join(',') : undefined,
      }),
      { replace: true },
    );
  };

  const toggleDeptFilter = (departmentId: string) => {
    applyFilters({
      dept: deptFilters.includes(departmentId)
        ? deptFilters.filter((candidate) => candidate !== departmentId)
        : [...deptFilters, departmentId],
    });
  };

  // Scoped at the data boundary: out-of-scope departments and, for Supervisors,
  // archived machines are never returned.
  const allMachines = useMemo(() => {
    // An explicit department filter wins over the current department, but is still
    // intersected with the access scope inside the repository.
    if (deptFilters.length > 0) {
      return deptFilters.flatMap((departmentId) =>
        repository.listMachinesForDepartment(departmentId, scope),
      );
    }
    return current
      ? repository.listMachinesForDepartment(current.id, scope)
      : repository.listMachinesInScope(scope);
  }, [repository, current, scope, deptFilters]);

  const filteredMachines = useMemo(() => {
    let result = allMachines;

    if (search) {
      result = result.filter(
        (m) =>
          m.code.toLowerCase().includes(search.toLowerCase()) ||
          m.name.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (statusFilters.length > 0) {
      result = result.filter((m) => statusFilters.includes(m.status));
    }

    if (dueFilter === 'soon') {
      result = result.filter((m) => m.status === 'active' && isDueSoon(m.nextMaintenanceDate));
    }

    if (dueFilter === 'overdue') {
      result = result.filter(
        (m) =>
          m.status !== 'retired' &&
          m.status !== 'under_maintenance' &&
          m.status !== 'under_repair' &&
          isOverdue(m.nextMaintenanceDate),
      );
    }

    if (sortColumn) {
      const mult = sortDirection === 'asc' ? 1 : -1;
      // Tie-break on code so equal values keep a stable, reproducible order.
      result = [...result].sort(
        (a, b) => a[sortColumn].localeCompare(b[sortColumn]) * mult || a.code.localeCompare(b.code),
      );
    }

    return result;
  }, [allMachines, search, statusFilters, dueFilter, sortColumn, sortDirection]);

  const paginatedMachines = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMachines.slice(start, start + itemsPerPage);
  }, [filteredMachines, currentPage]);

  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleStatusFilter = (status: MachineStatus) => {
    applyFilters({
      status: statusFilters.includes(status)
        ? statusFilters.filter((candidate) => candidate !== status)
        : [...statusFilters, status],
    });
  };

  const setDueFilter = (due: 'soon' | 'overdue' | null) => applyFilters({ due });

  const clearFilters = () => {
    setSearch('');
    setCurrentPage(1);
    setLocation(machineRegisterPath(), { replace: true });
  };

  const departmentLabel = (departmentId: string) =>
    available.find((department) => department.id === departmentId)?.code ?? departmentId;

  const activeFilterCount = statusFilters.length + (dueFilter ? 1 : 0) + (search ? 1 : 0);
  const statuses = machineStatuses;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machine Register"
        description={
          deptFilters.length > 0
            ? `Machinery across ${deptFilters.length} of your associated departments.`
            : current
              ? `Machinery and equipment in ${current.name} (${current.code}).`
              : 'Machinery and equipment across your authorized departments.'
        }
        actions={
          can(user, 'machine:add') && (
            <Link href={registeredRoutes.machineAdd}>
              <Button>
                <Plus size={16} className="mr-2" />
                Add Machine
              </Button>
            </Link>
          )
        }
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by code or name..."
        filters={
          <Button variant="outline" size="sm" onClick={() => setFilterOpen(!filterOpen)}>
            <Filter size={16} className="mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        }
        summary={
          <span className="text-sm text-muted-foreground font-medium">
            {filteredMachines.length} result{filteredMachines.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {/* Active scope and drill-down filters, shown as chips. The department chip is
          fixed because scope is not a filter the user can remove here. */}
      <div className="flex flex-wrap items-center gap-2">
        {deptFilters.length > 0 ? (
          deptFilters.map((departmentId) => (
            <button
              key={departmentId}
              type="button"
              onClick={() => toggleDeptFilter(departmentId)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
            >
              Department: {departmentLabel(departmentId)}
              <X size={12} aria-hidden="true" />
              <span className="sr-only">
                Remove {departmentLabel(departmentId)} department filter
              </span>
            </button>
          ))
        ) : current ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
            Department: {current.code}
            <span className="text-muted-foreground">({current.name})</span>
          </span>
        ) : null}

        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => toggleStatusFilter(status)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
          >
            {status.replace(/_/g, ' ')}
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove {status.replace(/_/g, ' ')} filter</span>
          </button>
        ))}

        {dueFilter ? (
          <button
            type="button"
            onClick={() => setDueFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
          >
            {dueFilter === 'soon' ? `Due within ${DUE_SOON_WINDOW_DAYS} days` : 'Overdue'}
            <X size={12} aria-hidden="true" />
            <span className="sr-only">Remove due filter</span>
          </button>
        ) : null}
      </div>

      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-3">Status</h4>
              <div className="space-y-2">
                {statuses.map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={statusFilters.includes(status)}
                      onCheckedChange={() => toggleStatusFilter(status)}
                    />
                    <StatusBadge status={status} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Maintenance due</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={dueFilter === 'soon'}
                    onCheckedChange={() => setDueFilter(dueFilter === 'soon' ? null : 'soon')}
                  />
                  <span className="text-sm">Due within {DUE_SOON_WINDOW_DAYS} days</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={dueFilter === 'overdue'}
                    onCheckedChange={() => setDueFilter(dueFilter === 'overdue' ? null : 'overdue')}
                  />
                  <span className="text-sm">Overdue</span>
                </label>
              </div>
            </div>

            {canChoose ? (
              <div>
                <h4 className="text-sm font-semibold mb-3">Associated departments</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {available.map((department) => (
                    <label key={department.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={deptFilters.includes(department.id)}
                        onCheckedChange={() => toggleDeptFilter(department.id)}
                      />
                      <span className="text-sm">
                        <span className="font-mono text-xs font-semibold">{department.code}</span>{' '}
                        {department.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Leave all unchecked to stay within {current?.code ?? 'the current department'}.
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ResponsiveRecordList
        isEmpty={filteredMachines.length === 0}
        table={
          <table className="w-full">
            <caption className="sr-only">
              Machine register, {filteredMachines.length} matching machines
            </caption>
            <thead className="bg-muted/30">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <th
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={
                    sortColumn === 'code'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() => handleSort('code')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Code{' '}
                    {sortColumn === 'code' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      ))}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={
                    sortColumn === 'name'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Name{' '}
                    {sortColumn === 'name' &&
                      (sortDirection === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      ))}
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  Department
                </th>
                <th scope="col" className="px-4 py-3">
                  Type
                </th>
                <th scope="col" className="px-4 py-3">
                  Manufacturer
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Next Maintenance
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedMachines.map((machine) => (
                <tr key={machine.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{machine.code}</td>
                  <td className="px-4 py-3 font-medium">{machine.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{machine.department}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {machine.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {machine.manufacturer}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={machine.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(machine.nextMaintenanceDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={machineDetailPath(machine.id)}>
                        <Button variant="ghost" size="sm">
                          <Eye size={14} />
                        </Button>
                      </Link>
                      {can(user, 'machine:edit') && (
                        <Link href={machineEditPath(machine.id)}>
                          <Button variant="ghost" size="sm">
                            <Edit size={14} />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        cards={paginatedMachines.map((machine) => (
          <div key={machine.id} className="bg-card border rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Link
                  href={machineDetailPath(machine.id)}
                  className="font-mono text-sm font-bold text-primary hover:underline"
                >
                  {machine.code}
                </Link>
                <p className="font-medium mt-1">{machine.name}</p>
              </div>
              <StatusBadge status={machine.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Dept:</span>{' '}
                <span className="font-medium">{machine.department}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>{' '}
                <span className="font-medium capitalize">{machine.type}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Manufacturer:</span>{' '}
                <span className="font-medium">{machine.manufacturer}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={machineDetailPath(machine.id)} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye size={14} className="mr-2" /> View
                </Button>
              </Link>
              {can(user, 'machine:edit') && (
                <Link href={machineEditPath(machine.id)} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit size={14} className="mr-2" /> Edit
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      />

      {filteredMachines.length === 0 &&
        (activeFilterCount > 0 ? (
          <EmptyState
            title="No machines found"
            description="No machine matches the current search and filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No machines registered"
            description="Get started by adding your first machine to the register."
            action={
              can(user, 'machine:add') && (
                <Link href={registeredRoutes.machineAdd}>
                  <Button>
                    <Plus size={16} className="mr-2" /> Add Machine
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
    </div>
  );
}
