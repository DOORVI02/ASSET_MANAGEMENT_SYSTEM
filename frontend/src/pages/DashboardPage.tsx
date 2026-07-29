import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { DUE_SOON_WINDOW_DAYS } from '@/lib/maintenance-window';
import { PageHeader } from '@/components/shared/PageHeader';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { Link } from 'wouter';
import type { LucideIcon } from 'lucide-react';
import {
  Settings2,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Plus,
  FileText,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useDepartment } from '@/hooks/use-department';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listAllMaintenanceInScope } from '@/lib/supabase/maintenance';
import { listAllRepairsInScope } from '@/lib/supabase/repairs';
import { getDepartmentSummary } from '@/lib/supabase/departments';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { isDueSoon, isOverdue } from '@/lib/maintenance-window';
import {
  machineDetailPath,
  machineRegisterPath,
  maintenanceDetailPath,
  repairDetailPath,
} from '@/lib/routes';
import { can } from '@/lib/permissions';

export default function DashboardPage() {
  const { user } = useAuth();
  const { current, available, scope } = useDepartment();
  const isOfficer = can(user, 'machine:add');
  const departmentId = current?.id;
  const enabled = Boolean(departmentId) && scope.departmentIds.length > 0;

  // Every count below comes from the same scoped machine list the drill-down links
  // resolve to, so a card can never disagree with the page it opens.
  const { data: machines = [], isPending: machinesPending } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), departmentId ?? ''],
    queryFn: () => listAllMachinesInScope(scope, departmentId),
    enabled,
  });

  const { data: summary, isPending: summaryPending } = useQuery({
    queryKey: queryKeys.departments.summary(departmentId ?? ''),
    queryFn: () => getDepartmentSummary(departmentId ?? '', scope),
    enabled,
  });

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: [...queryKeys.maintenance.all(departmentId ?? ''), 'dashboard'],
    queryFn: () => listAllMaintenanceInScope(scope, departmentId),
    enabled,
  });

  const { data: repairRecords = [] } = useQuery({
    queryKey: [...queryKeys.repairs.all(departmentId ?? ''), 'dashboard'],
    queryFn: () => listAllRepairsInScope(scope, departmentId),
    enabled,
  });

  const needsAttention = useMemo(
    () =>
      machines
        .filter(
          (machine) =>
            machine.status === 'under_repair' ||
            machine.status === 'under_maintenance' ||
            (machine.status === 'active' && isOverdue(machine.nextMaintenanceDate)) ||
            (machine.status === 'active' && isDueSoon(machine.nextMaintenanceDate)),
        )
        .slice(0, 5),
    [machines],
  );

  const upcomingMaintenance = useMemo(
    () =>
      maintenanceRecords
        .filter((record) => record.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, 5),
    [maintenanceRecords],
  );

  const recentRepairs = useMemo(() => repairRecords.slice(0, 5), [repairRecords]);

  /**
   * Per-department machine counts for the chart, one summary query each. Read from the
   * `department_summary` view rather than by loading every department's machines — the chart
   * needs one number per department, not the rows behind it.
   */
  const deptSummaryQueries = useQueries({
    queries: available.map((department) => ({
      queryKey: queryKeys.departments.summary(department.id),
      queryFn: () => getDepartmentSummary(department.id, scope),
      enabled: scope.departmentIds.length > 0,
    })),
  });

  const deptData = useMemo(
    () =>
      available.map((department, index) => ({
        name: department.code,
        count: deptSummaryQueries[index]?.data?.total ?? 0,
      })),
    [available, deptSummaryQueries],
  );

  // A department is selected but its figures are still in flight. Rendering the cards now
  // would show zeros that read as real counts, which is exactly the reading someone acts on.
  if (current && (machinesPending || summaryPending)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description={`Loading ${current.name}…`} />
        <LoadingState label="Loading dashboard…" />
      </div>
    );
  }

  if (!current || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="No department is selected." />
        <EmptyState
          title="Select a department first"
          description="Dashboard counts are scoped to one department. Choose one to continue."
        />
      </div>
    );
  }

  const statusData = [
    { name: 'Active', value: summary.active, color: 'hsl(var(--chart-2))' },
    { name: 'Under maint.', value: summary.underMaintenance, color: 'hsl(var(--chart-1))' },
    { name: 'Under repair', value: summary.underRepair, color: 'hsl(var(--chart-3))' },
    {
      name: 'Inactive / retired',
      value: summary.inactive + summary.retired,
      color: 'hsl(var(--chart-5))',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${current.name} dashboard`}
        description={`${current.code} · ${user?.name}. Every count below is scoped to this department.`}
      />

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total machines"
          value={summary.total}
          icon={Settings2}
          href={machineRegisterPath()}
        />
        <MetricCard
          title="Active"
          value={summary.active}
          icon={Activity}
          color="text-emerald-600"
          bgColor="bg-emerald-100 dark:bg-emerald-900/30"
          href={machineRegisterPath({ status: 'active' })}
        />
        <MetricCard
          title="Under maintenance"
          value={summary.underMaintenance}
          icon={Wrench}
          color="text-blue-600"
          bgColor="bg-blue-100 dark:bg-blue-900/30"
          href={machineRegisterPath({ status: 'under_maintenance' })}
        />
        <MetricCard
          title="Under repair"
          value={summary.underRepair}
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-amber-100 dark:bg-amber-900/30"
          href={machineRegisterPath({ status: 'under_repair' })}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={`Due soon (${DUE_SOON_WINDOW_DAYS}d)`}
          value={summary.dueSoon}
          icon={Clock}
          color="text-amber-600"
          href={machineRegisterPath({ due: 'soon' })}
        />
        <MetricCard
          title="Overdue"
          value={summary.overdue}
          icon={AlertCircle}
          color="text-red-600"
          bgColor="bg-red-100 dark:bg-red-900/30"
          href={machineRegisterPath({ due: 'overdue' })}
        />
        <MetricCard
          title="Inactive"
          value={summary.inactive}
          icon={XCircle}
          color="text-muted-foreground"
          href={machineRegisterPath({ status: 'inactive' })}
        />
        <MetricCard
          title="Retired"
          value={summary.retired}
          icon={CheckCircle2}
          color="text-muted-foreground"
          href={machineRegisterPath({ status: 'retired' })}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isOfficer && (
          <ActionCard
            title="Add machine"
            icon={Plus}
            href="/machines/add"
            color="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        )}
        <ActionCard title="Log maintenance" icon={Wrench} href="/maintenance/add" />
        <ActionCard title="Report repair" icon={AlertTriangle} href="/repairs/add" />
        <ActionCard title="View reports" icon={FileText} href="/reports" />
      </div>

      {/* Charts Row — two cards, so two columns. This was `lg:grid-cols-3`, which
          squeezed both charts into the left two thirds and left a dead column. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Status distribution</h3>
          {/* The SVG carries no accessible content, so the figures are also given as
              text. `aria-hidden` stops a screen reader walking the chart's markup. */}
          <div className="h-64" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{summary.active}</span> of {summary.total}{' '}
            machines are currently active.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-sm">
            {statusData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-2">
                <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </dt>
                <dd className="font-medium tabular-nums text-foreground">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Machines by authorized department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <RechartsTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground sr-only">
            Machine count for each of your {deptData.length} authorized departments:{' '}
            {deptData.map((entry) => `${entry.name} ${entry.count}`).join(', ')}.
          </p>
        </div>
      </div>

      {/* Tables Row — three panels, so they only sit flush at xl. At lg the third
          would otherwise sit alone on a half-width row. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Needs attention */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              Needs attention
            </h3>
            <Link href="/machines" className="text-sm text-primary hover:underline font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y flex-1">
            {needsAttention.length > 0 ? (
              needsAttention.map((machine) => (
                <div
                  key={machine.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={machineDetailPath(machine.id)}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {machine.code}
                      </Link>
                      <StatusBadge status={machine.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {machine.name} • {machine.department}
                    </p>
                  </div>
                  <Link
                    href={machineDetailPath(machine.id)}
                    className="text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground px-3 py-1 rounded-md transition-colors"
                  >
                    View
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No machines need immediate attention.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming maintenance */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock size={18} className="text-blue-500" />
              Upcoming maintenance
            </h3>
            <Link href="/maintenance" className="text-sm text-primary hover:underline font-medium">
              View schedule
            </Link>
          </div>
          <div className="divide-y flex-1">
            {upcomingMaintenance.length > 0 ? (
              upcomingMaintenance.map((record) => (
                <Link
                  key={record.id}
                  href={maintenanceDetailPath(record.id)}
                  className="block p-4 transition-colors hover:bg-muted/10"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">
                      {record.machineCode} - {record.type}
                    </span>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                      {formatDateTime(record.scheduledDate).split(',')[0]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{record.description}</p>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No upcoming maintenance scheduled.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Recent repairs
            </h3>
            <Link href="/repairs" className="text-sm text-primary hover:underline font-medium">
              View repairs
            </Link>
          </div>
          <div className="divide-y flex-1">
            {recentRepairs.length ? (
              recentRepairs.map((record) => (
                <Link
                  key={record.id}
                  href={repairDetailPath(record.id)}
                  className="block p-4 transition-colors hover:bg-muted/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{record.machineCode}</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {record.description}
                  </p>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No repairs reported.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: string;
  bgColor?: string;
  /** Filtered machine-register URL this count drills into. */
  href?: string;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color = 'text-muted-foreground',
  bgColor = 'bg-muted/50',
  href,
}: MetricCardProps) {
  const body = (
    <div
      className={cn(
        'flex h-full items-start justify-between rounded-lg border bg-card p-5 shadow-sm transition-all',
        // Only the drill-through cards react to the pointer; a static card that
        // lifts on hover promises a click target that isn't there.
        href && 'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md',
      )}
    >
      <div>
        <p className="mb-1 text-sm font-medium text-muted-foreground">{title}</p>
        <h4 className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</h4>
      </div>
      <div className={cn('rounded-full p-2.5', bgColor)}>
        <Icon size={20} className={color} aria-hidden="true" />
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${title}: ${value}. View matching machines.`}
    >
      {body}
    </Link>
  );
}

interface ActionCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  color?: string;
}

function ActionCard({
  title,
  icon: Icon,
  href,
  color = 'bg-card hover:bg-accent text-foreground',
}: ActionCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          'flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
          color,
        )}
      >
        <Icon size={24} aria-hidden="true" className="opacity-80" />
        <span className="text-sm font-medium">{title}</span>
      </div>
    </Link>
  );
}
