import { useMemo, useState, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, ArrowLeft, Edit, Plus, RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MachinePartsTable } from '@/components/machines/MachinePartsTable';
import { MachineImage } from '@/components/machines/MachineImage';
import { MachineActivityTimeline } from '@/components/machines/MachineActivityTimeline';
import { formatDate, formatDateTime } from '@/lib/utils';
import { DUE_SOON_WINDOW_DAYS, isDueSoon, isOverdue } from '@/lib/maintenance-window';
import { maintenanceDueState } from '@/lib/maintenance-record';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  archiveMachine,
  getMachineImage,
  getMachineInScope,
  restoreMachine,
} from '@/lib/supabase/machines';
import { listAllPartsForMachine } from '@/lib/supabase/parts';
import { listAllMaintenanceForMachine } from '@/lib/supabase/maintenance';
import { listAllRepairsForMachine } from '@/lib/supabase/repairs';
import { listAuditLogsForEntity } from '@/lib/supabase/audit-logs';
import { listDisplayNames } from '@/lib/supabase/profiles';
import { queryKeys } from '@/lib/supabase/query-keys';
import {
  machineEditPath,
  maintenanceDetailPath,
  maintenancePath,
  partsPath,
  repairDetailPath,
  registeredRoutes,
} from '@/lib/routes';
import type { FeedbackMessage as FeedbackModel } from '@/lib/types';

export default function MachineDetailPage() {
  const [, params] = useRoute(registeredRoutes.machineDetail);
  const { user } = useAuth();
  const { scope } = useDepartment();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);
  const [currentTimestamp] = useState(() => Date.now());
  const machineId = params?.id;

  const enabled = Boolean(machineId) && scope.departmentIds.length > 0;

  const {
    data: machine,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.machines.detail(machineId ?? ''),
    queryFn: () => getMachineInScope(machineId ?? '', scope),
    enabled,
  });

  /**
   * The child histories are separate queries rather than one joined read, so a slow or
   * failing tab cannot hold up the overview. Each is scoped server-side by the same RLS the
   * machine itself passed through.
   */
  const { data: maintenanceHistory = [] } = useQuery({
    queryKey: queryKeys.maintenance.forMachine(machineId ?? ''),
    queryFn: () => listAllMaintenanceForMachine(machineId ?? '', scope),
    enabled,
  });
  const { data: repairHistory = [] } = useQuery({
    queryKey: queryKeys.repairs.forMachine(machineId ?? ''),
    queryFn: () => listAllRepairsForMachine(machineId ?? '', scope),
    enabled,
  });
  const { data: parts = [] } = useQuery({
    queryKey: queryKeys.parts.forMachine(machineId ?? ''),
    queryFn: () => listAllPartsForMachine(machineId ?? '', scope),
    enabled,
  });
  const { data: activity = [] } = useQuery({
    queryKey: queryKeys.machines.audit(machineId ?? ''),
    queryFn: () => listAuditLogsForEntity('machine', machineId ?? ''),
    enabled,
  });

  /**
   * Actor names for the activity timeline, resolved through the `profile_display_names` RPC
   * — `profiles` itself is readable only for your own row, so this is the only way to turn
   * an audit row's `performed_by` into a name.
   *
   * Depends on the audit rows because the set of ids to resolve comes from them. An id the
   * RPC declines to resolve is simply absent from the map, and the timeline falls back
   * rather than treating it as an error.
   */
  const actorIds = useMemo(() => [...new Set(activity.map((row) => row.performedBy))], [activity]);
  const { data: actorNames } = useQuery({
    queryKey: [...queryKeys.profiles.names(), actorIds],
    queryFn: () => listDisplayNames(actorIds),
    enabled: actorIds.length > 0,
  });

  const { data: machineImage, refetch: refetchImage } = useQuery({
    queryKey: queryKeys.machines.image(machineId ?? ''),
    queryFn: () => getMachineImage(machineId ?? ''),
    enabled,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <LoadingState label="Loading machine…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Could not load this machine"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  // Reached only after a successful fetch, so this is genuinely "no such machine in your
  // scope" rather than "not loaded yet" — a distinction a synchronous repository could not
  // draw.
  if (!machine) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Machine not found"
          description={`No machine matches the identifier "${machineId ?? ''}". It may have been removed from the register, or belong to a department outside your access.`}
          action={
            <Link href="/machines">
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to register
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isMaintenanceOverdue =
    isOverdue(machine.nextMaintenanceDate, currentTimestamp) && !machine.isArchived;
  const isMaintenanceDueSoon =
    isDueSoon(machine.nextMaintenanceDate, currentTimestamp) && !machine.isArchived;
  const needsAttention =
    machine.status === 'under_repair' ||
    machine.status === 'under_maintenance' ||
    isMaintenanceOverdue ||
    isMaintenanceDueSoon;

  const canEdit = can(user, 'machine:edit') && !machine.isArchived;
  const canArchive = can(user, 'machine:archive');
  const canManageImages = can(user, 'images:upload');

  const handleArchive = async () => {
    // No actor argument: the audit trigger records `auth.uid()` server-side.
    const result = await archiveMachine(machine.id);
    // Invalidated by prefix so the register, this record and its freshly-written audit row
    // all refetch — archiving changes the status shown in three different places.
    await queryClient.invalidateQueries({ queryKey: ['machines'] });
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: `${result.data.code} archived`,
            description:
              'The machine is now retired and hidden from the active register. Restore it to make it editable again.',
          }
        : { state: 'validation', title: 'Machine not archived', description: result.message },
    );
  };

  const handleRestore = async () => {
    const result = await restoreMachine(machine.id);
    await queryClient.invalidateQueries({ queryKey: ['machines'] });
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: `${result.data.code} restored`,
            description: 'The machine is active in the register again with status Inactive.',
          }
        : { state: 'validation', title: 'Machine not restored', description: result.message },
    );
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/machines">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back
          </Button>
        </Link>
      </div>

      {feedback ? <FeedbackMessage feedback={feedback} /> : null}

      {machine.isArchived ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This machine is archived',
            description:
              'Archived machines are kept for history and are read-only. Restore the machine to edit it or change its images.',
          }}
        />
      ) : null}

      {needsAttention ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            size={20}
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-300">Attention required</h2>
            <ul className="text-sm text-amber-800 dark:text-amber-400">
              {machine.status === 'under_repair' ? <li>This machine is under repair.</li> : null}
              {machine.status === 'under_maintenance' ? (
                <li>This machine is under maintenance.</li>
              ) : null}
              {isMaintenanceOverdue ? (
                <li>Maintenance was due {formatDate(machine.nextMaintenanceDate)}.</li>
              ) : null}
              {isMaintenanceDueSoon ? (
                <li>
                  Maintenance is due within {DUE_SOON_WINDOW_DAYS} days, on{' '}
                  {formatDate(machine.nextMaintenanceDate)}.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{machine.code}</h1>
              <StatusBadge status={machine.status} />
            </div>
            <p className="text-xl font-medium text-muted-foreground">{machine.name}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{machine.manufacturer}</span>
              <span aria-hidden="true">•</span>
              <span>{machine.model}</span>
              <span aria-hidden="true">•</span>
              <span className="capitalize">{machine.type}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link href={machineEditPath(machine.id)}>
                <Button variant="outline">
                  <Edit size={16} className="mr-2" aria-hidden="true" /> Edit
                </Button>
              </Link>
            ) : null}

            {canArchive && !machine.isArchived ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Archive size={16} className="mr-2" aria-hidden="true" /> Archive
                  </Button>
                }
                title="Archive machine"
                description={`Archive ${machine.code}? It will be retired and hidden from the active register. History is preserved and the machine can be restored.`}
                confirmText="Archive machine"
                onConfirm={handleArchive}
              />
            ) : null}

            {canArchive && machine.isArchived ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <RotateCcw size={16} className="mr-2" aria-hidden="true" /> Restore
                  </Button>
                }
                title="Restore machine"
                description={`Restore ${machine.code} to the active register? Its status becomes Inactive so you can review it before returning it to service.`}
                confirmText="Restore machine"
                onConfirm={handleRestore}
              />
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 sm:grid-cols-4">
          <SummaryStat label="Installed" value={formatDate(machine.installationDate)} />
          <SummaryStat
            label="Last maint."
            value={machine.lastMaintenanceDate ? formatDate(machine.lastMaintenanceDate) : '—'}
          />
          <SummaryStat label="Next maint." value={formatDate(machine.nextMaintenanceDate)} />
          <SummaryStat label="Department" value={machine.department} />
        </dl>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
          <TabsTrigger value="images">Image</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <DetailCard title="Basic information">
                <DetailRows>
                  <DetailRow label="Machine code" value={machine.code} />
                  <DetailRow label="Machine name" value={machine.name} />
                  <DetailRow label="Department" value={machine.department} />
                  <DetailRow
                    label="Type"
                    value={<span className="capitalize">{machine.type}</span>}
                  />
                  <DetailRow label="Manufacturer" value={machine.manufacturer} />
                  <DetailRow label="Model" value={machine.model} />
                  <DetailRow label="Serial number" value={machine.serialNumber} />
                </DetailRows>
              </DetailCard>

              <DetailCard title="Technical ratings">
                <DetailRows>
                  <DetailRow label="Capacity" value={machine.capacity} />
                  <DetailRow label="Power rating" value={machine.powerRating} />
                  <DetailRow label="Voltage" value={machine.voltage} />
                  <DetailRow label="Weight" value={machine.weight} />
                </DetailRows>
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  Conveyor drum, pulley, and plummer-block specifications are not captured yet —
                  their engineering units are still pending confirmation.
                </p>
              </DetailCard>

              <DetailCard title="Location">
                <DetailRows>
                  <DetailRow label="Location" value={machine.location} />
                  <DetailRow label="Plant area" value={machine.plantArea} />
                  <DetailRow label="Bay or section" value={machine.baySection} />
                  <DetailRow label="Floor" value={machine.floor} />
                  <DetailRow label="Room or position" value={machine.roomPosition} />
                </DetailRows>
              </DetailCard>
            </div>

            <div className="space-y-6">
              <DetailCard title="Machine image">
                {machineImage ? (
                  <img
                    src={machineImage.url}
                    alt={`Image of ${machine.code}`}
                    className="h-48 w-full rounded-lg bg-muted/30 object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    No image available
                  </div>
                )}
              </DetailCard>

              <div className="grid grid-cols-3 gap-4">
                <CountTile label="Parts" value={parts.length} />
                <CountTile label="Maintenance" value={maintenanceHistory.length} />
                <CountTile label="Repairs" value={repairHistory.length} accent="text-amber-600" />
              </div>

              <DetailCard title="Status and dates">
                <DetailRows>
                  <DetailRow label="Status" value={<StatusBadge status={machine.status} />} />
                  <DetailRow
                    label="Installation date"
                    value={formatDate(machine.installationDate)}
                  />
                  <DetailRow
                    label="Last maintenance"
                    value={
                      machine.lastMaintenanceDate
                        ? formatDate(machine.lastMaintenanceDate)
                        : undefined
                    }
                  />
                  <DetailRow
                    label="Next maintenance"
                    value={formatDate(machine.nextMaintenanceDate)}
                  />
                  <DetailRow label="Record updated" value={formatDateTime(machine.updatedAt)} />
                </DetailRows>
              </DetailCard>

              <DetailCard title="Description">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {machine.description || 'No description available.'}
                </p>
              </DetailCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="parts" className="mt-6 space-y-4">
          <MachinePartsTable parts={parts} machineCode={machine.code} />
          <div className="flex flex-wrap items-center gap-3">
            {can(user, 'parts:add') && !machine.isArchived ? (
              <Link href={`${registeredRoutes.partAdd}?machine=${machine.id}`}>
                <Button size="sm">
                  <Plus size={14} className="mr-2" aria-hidden="true" /> Fit part to this machine
                </Button>
              </Link>
            ) : null}
            <Link
              href={partsPath({ machine: machine.id })}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open in Installed Parts
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {can(user, 'maintenance:add') && !machine.isArchived ? (
              <Link href={`${registeredRoutes.maintenanceAdd}?machine=${machine.id}`}>
                <Button size="sm">
                  <Plus size={14} className="mr-2" aria-hidden="true" /> Log maintenance for this
                  machine
                </Button>
              </Link>
            ) : null}
            <Link
              href={maintenancePath({ machine: machine.id })}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open in Maintenance
            </Link>
          </div>

          {maintenanceHistory.length > 0 ? (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {maintenanceHistory.map((record) => (
                <li key={record.id} className="p-5 transition-colors hover:bg-muted/10">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Link
                          href={maintenanceDetailPath(record.id)}
                          className="font-semibold capitalize text-primary hover:underline"
                        >
                          {record.type.replace(/_/g, ' ')}
                        </Link>
                        <StatusBadge status={record.status} />
                        <StatusBadge status={maintenanceDueState(record)} />
                      </div>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">
                      {formatDate(record.scheduledDate)}
                    </span>
                  </div>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>Technician:</dt>
                      <dd className="font-medium">{record.technicianName}</dd>
                    </div>
                    {record.completedDate ? (
                      <div className="flex gap-1">
                        <dt>Completed:</dt>
                        <dd className="font-medium">{formatDate(record.completedDate)}</dd>
                      </div>
                    ) : null}
                    {record.durationHours ? (
                      <div className="flex gap-1">
                        <dt>Duration:</dt>
                        <dd className="font-medium">{record.durationHours} h</dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No maintenance records"
              description={`No maintenance has been logged against ${machine.code}.`}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Logging and scheduling maintenance arrives with the Maintenance Management page.
          </p>
        </TabsContent>

        <TabsContent value="repairs" className="mt-6 space-y-4">
          {repairHistory.length > 0 ? (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {repairHistory.map((record) => (
                <li key={record.id} className="p-5 transition-colors hover:bg-muted/10">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={record.status} />
                        <span className="text-xs font-semibold">
                          Reported {formatDate(record.reportedDate)}
                        </span>
                      </div>
                      <Link
                        href={repairDetailPath(record.id)}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {record.description}
                      </Link>
                      {record.diagnosis ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Diagnosis: {record.diagnosis}
                        </p>
                      ) : null}
                      {record.resolution ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Resolution: {record.resolution}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>Reported by:</dt>
                      <dd className="font-medium">{record.reportedBy}</dd>
                    </div>
                    {record.assignedTo ? (
                      <div className="flex gap-1">
                        <dt>Assigned to:</dt>
                        <dd className="font-medium">{record.assignedTo}</dd>
                      </div>
                    ) : null}
                    {record.downtimeHours ? (
                      <div className="flex gap-1">
                        <dt>Downtime:</dt>
                        <dd className="font-medium">{record.downtimeHours} h</dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No repair records"
              description={`No repairs have been reported against ${machine.code}.`}
            />
          )}
          {can(user, 'repair:add') && !machine.isArchived ? (
            <Link href={`${registeredRoutes.repairAdd}?machine=${machine.id}`}>
              <Button variant="outline" size="sm">
                <Plus size={14} className="mr-2" aria-hidden="true" /> Report repair
              </Button>
            </Link>
          ) : null}
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <MachineImage
            machineId={machine.id}
            machineCode={machine.code}
            image={machineImage}
            canManage={canManageImages}
            isArchived={machine.isArchived}
            onChanged={() => refetchImage()}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <MachineActivityTimeline events={activity} actorNames={actorNames} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Definition list wrapper for a card built from `DetailRow` entries. */
function DetailRows({ children }: { children: ReactNode }) {
  return <dl className="space-y-3">{children}</dl>;
}

function CountTile({
  label,
  value,
  accent = 'text-primary',
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}
