import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Ban, CheckCircle2, Edit, PlayCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSection } from '@/components/shared/PageSection';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MachineFormField } from '@/components/machines/MachineFormField';
import { fieldAria } from '@/lib/form-aria';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import { maintenanceDueState } from '@/lib/maintenance-record';
import {
  maintenanceCancellationSchema,
  maintenanceCompletionSchema,
  type MaintenanceCancellationValues,
  type MaintenanceCompletionValues,
} from '@/lib/maintenance-form';
import { formatDate, formatDateTime } from '@/lib/utils';
import { machineDetailPath, maintenanceEditPath, registeredRoutes } from '@/lib/routes';
import type { FeedbackMessage as FeedbackModel } from '@/lib/types';

export default function MaintenanceDetailPage() {
  const [, params] = useRoute(registeredRoutes.maintenanceDetail);
  const { user } = useAuth();
  const { scope } = useDepartment();
  const repository = useMockRepository();
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);
  const recordId = params?.id;

  const record = useMemo(
    () => (recordId ? repository.getMaintenanceRecordInScope(recordId, scope) : undefined),
    [recordId, repository, scope],
  );
  const canWrite = can(user, 'maintenance:edit');

  if (!record) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Maintenance record not found"
          description={`No maintenance record matches the identifier "${recordId ?? ''}".`}
          action={
            <Link href={registeredRoutes.maintenance}>
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to maintenance
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const dueState = maintenanceDueState(record);

  const handleStart = () => {
    const result = mockRepository.startMaintenanceRecord(record.id, user?.id ?? 'unknown');
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: 'Maintenance started',
            description: 'Status set to in progress.',
          }
        : { state: 'validation', title: 'Not started', description: result.message },
    );
  };

  const handleReopen = () => {
    const result = mockRepository.reopenMaintenanceRecord(record.id, user?.id ?? 'unknown');
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: 'Maintenance reopened',
            description: 'Status returned to in progress.',
          }
        : { state: 'validation', title: 'Not reopened', description: result.message },
    );
  };

  return (
    // Matches PartDetailPage's width: both use the identical two-column PageSection/
    // DetailRow pattern, and 4xl vs 5xl between them was unexplained drift.
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.maintenance}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to maintenance
        </Button>
      </Link>

      {feedback ? <FeedbackMessage feedback={feedback} /> : null}

      <PageHeader
        title={`${titleCase(record.type)} maintenance`}
        description={`${record.machineCode} · scheduled ${formatDate(record.scheduledDate)}`}
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              {record.status === 'scheduled' ? (
                <Button variant="outline" onClick={handleStart}>
                  <PlayCircle size={16} className="mr-2" aria-hidden="true" /> Start
                </Button>
              ) : null}
              {record.status === 'scheduled' || record.status === 'in_progress' ? (
                <>
                  <CompleteDialog
                    recordId={record.id}
                    actorId={user?.id ?? 'unknown'}
                    onCompleted={setFeedback}
                  />
                  <CancelDialog
                    recordId={record.id}
                    actorId={user?.id ?? 'unknown'}
                    onCancelled={setFeedback}
                  />
                  <Link href={maintenanceEditPath(record.id)}>
                    <Button variant="outline">
                      <Edit size={16} className="mr-2" aria-hidden="true" /> Edit
                    </Button>
                  </Link>
                </>
              ) : null}
              {record.status === 'completed' ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline">
                      <RotateCcw size={16} className="mr-2" aria-hidden="true" /> Reopen
                    </Button>
                  }
                  title="Reopen this record?"
                  description="Reopening returns this maintenance to in progress and restarts its due tracking."
                  confirmText="Reopen"
                  onConfirm={handleReopen}
                />
              ) : null}
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PageSection title="Status" description="Current state and due tracking.">
          <dl className="space-y-3">
            <DetailRow label="Status" value={<StatusBadge status={record.status} />} />
            <DetailRow label="Due state" value={<StatusBadge status={dueState} />} />
            <DetailRow
              label="Machine"
              value={
                <Link
                  href={machineDetailPath(record.machineId)}
                  className="font-mono text-primary hover:underline"
                >
                  {record.machineCode}
                </Link>
              }
            />
            <DetailRow label="Scheduled" value={formatDate(record.scheduledDate)} />
            <DetailRow
              label="Completed"
              value={record.completedDate ? formatDate(record.completedDate) : undefined}
            />
            <DetailRow label="Technician" value={record.technicianName} />
            <DetailRow
              label="Duration"
              value={record.durationHours ? `${record.durationHours} h` : undefined}
            />
            <DetailRow label="Record updated" value={formatDateTime(record.updatedAt)} />
          </dl>
        </PageSection>

        <PageSection title="Work" description="What was planned, found, and done.">
          <dl className="space-y-3">
            <DetailRow label="Description" value={record.description} />
            <DetailRow label="Findings" value={record.findings} />
            <DetailRow label="Actions" value={record.actions} />
            <DetailRow label="Parts used" value={record.partsUsed} />
            <DetailRow label="Remarks" value={record.remarks} />
          </dl>
        </PageSection>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function CompleteDialog({
  recordId,
  actorId,
  onCompleted,
}: {
  recordId: string;
  actorId: string;
  onCompleted: (feedback: FeedbackModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MaintenanceCompletionValues>({
    actions: '',
    findings: '',
    durationHours: undefined,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MaintenanceCompletionValues, string>>>(
    {},
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = maintenanceCompletionSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof MaintenanceCompletionValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in next)) {
          next[field as keyof MaintenanceCompletionValues] = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setErrors({});
    const result = mockRepository.completeMaintenanceRecord(recordId, actorId, parsed.data);
    setOpen(false);
    onCompleted(
      result.ok
        ? {
            state: 'success',
            title: 'Maintenance completed',
            description: 'Record marked completed.',
          }
        : { state: 'validation', title: 'Not completed', description: result.message },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CheckCircle2 size={16} className="mr-2" aria-hidden="true" /> Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Complete maintenance</DialogTitle>
            <DialogDescription>Record what was done before closing this out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <MachineFormField
              id="complete-actions"
              label="Actions taken"
              required
              error={errors.actions}
            >
              <Textarea
                {...fieldAria('complete-actions', errors.actions)}
                rows={3}
                value={values.actions}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, actions: event.target.value }))
                }
              />
            </MachineFormField>
            <MachineFormField id="complete-findings" label="Findings" error={errors.findings}>
              <Textarea
                {...fieldAria('complete-findings', errors.findings)}
                rows={2}
                value={values.findings ?? ''}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, findings: event.target.value }))
                }
              />
            </MachineFormField>
            <MachineFormField
              id="complete-durationHours"
              label="Duration (hours)"
              error={errors.durationHours}
            >
              <Input
                {...fieldAria('complete-durationHours', errors.durationHours)}
                type="number"
                min={0}
                step="0.5"
                value={values.durationHours ?? ''}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    durationHours:
                      event.target.value === '' ? undefined : event.target.valueAsNumber,
                  }))
                }
              />
            </MachineFormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Mark completed</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  recordId,
  actorId,
  onCancelled,
}: {
  recordId: string;
  actorId: string;
  onCancelled: (feedback: FeedbackModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MaintenanceCancellationValues>({ reason: '' });
  const [errors, setErrors] = useState<
    Partial<Record<keyof MaintenanceCancellationValues, string>>
  >({});

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = maintenanceCancellationSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof MaintenanceCancellationValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in next)) {
          next[field as keyof MaintenanceCancellationValues] = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setErrors({});
    const result = mockRepository.cancelMaintenanceRecord(recordId, actorId, parsed.data.reason);
    setOpen(false);
    onCancelled(
      result.ok
        ? {
            state: 'success',
            title: 'Maintenance cancelled',
            description: 'Record marked cancelled.',
          }
        : { state: 'validation', title: 'Not cancelled', description: result.message },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ban size={16} className="mr-2" aria-hidden="true" /> Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Cancel maintenance</DialogTitle>
            <DialogDescription>State why this maintenance is being cancelled.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <MachineFormField id="cancel-reason" label="Reason" required error={errors.reason}>
              <Input
                {...fieldAria('cancel-reason', errors.reason)}
                value={values.reason}
                onChange={(event) => setValues({ reason: event.target.value })}
              />
            </MachineFormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep record
            </Button>
            <Button type="submit" variant="destructive">
              Cancel maintenance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
