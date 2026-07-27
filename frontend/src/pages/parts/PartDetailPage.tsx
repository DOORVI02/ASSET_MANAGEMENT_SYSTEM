import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Edit, History, Repeat, RotateCcw, Trash2 } from 'lucide-react';
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
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import { partLifeState, replacementDueDate } from '@/lib/part-life';
import { partReplacementSchema, type PartReplacementValues } from '@/lib/part-form';
import { toDateInputValue } from '@/lib/machine-form';
import { formatDate, formatDateTime } from '@/lib/utils';
import { machineDetailPath, partEditPath, registeredRoutes } from '@/lib/routes';
import type { FeedbackMessage as FeedbackModel } from '@/lib/types';

export default function PartDetailPage() {
  const [, params] = useRoute(registeredRoutes.partDetail);
  const { user } = useAuth();
  const { scope } = useDepartment();
  const repository = useMockRepository();
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);
  const partId = params?.id;

  const part = useMemo(
    () => (partId ? repository.getPartInScope(partId, scope) : undefined),
    [partId, repository, scope],
  );
  const replacements = useMemo(
    () => (partId ? repository.listPartReplacements(partId) : []),
    [partId, repository],
  );
  const users = useMemo(() => repository.listUsers(), [repository]);

  const canWrite = can(user, 'parts:edit');

  if (!part) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Part not found"
          description={`No installed part matches the identifier "${partId ?? ''}".`}
          action={
            <Link href={registeredRoutes.parts}>
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to parts
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const dueDate = replacementDueDate(part);
  const lifeState = partLifeState(part);
  const actorName = (actorId: string) =>
    users.find((candidate) => candidate.id === actorId)?.name ?? 'System';

  const handleRemove = () => {
    const result = mockRepository.archivePart(part.id, user?.id ?? 'unknown');
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: `${result.data.partCode} removed`,
            description:
              'The component is no longer fitted. Its history is kept and it can be restored.',
          }
        : { state: 'validation', title: 'Part not removed', description: result.message },
    );
  };

  const handleRestore = () => {
    const result = mockRepository.restorePart(part.id, user?.id ?? 'unknown');
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: `${result.data.partCode} restored`,
            description: 'The component is fitted again.',
          }
        : { state: 'validation', title: 'Part not restored', description: result.message },
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.parts}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to parts
        </Button>
      </Link>

      {feedback ? <FeedbackMessage feedback={feedback} /> : null}

      {part.isArchived ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This part is no longer fitted',
            description:
              'Removed components are kept for history and are read-only. Restore it to make changes.',
          }}
        />
      ) : null}

      <PageHeader
        title={part.partCode}
        description={`${part.partName} · fitted to ${part.machineCode}`}
        actions={
          canWrite && !part.isArchived ? (
            <div className="flex flex-wrap gap-2">
              <ReplaceDialog
                partCode={part.partCode}
                onReplaced={(message) => setFeedback(message)}
                partId={part.id}
                actorId={user?.id ?? 'unknown'}
              />
              <Link href={partEditPath(part.id)}>
                <Button variant="outline">
                  <Edit size={16} className="mr-2" aria-hidden="true" /> Edit
                </Button>
              </Link>
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Trash2 size={16} className="mr-2" aria-hidden="true" /> Remove
                  </Button>
                }
                title="Remove this part?"
                description={`Remove ${part.partCode} from ${part.machineCode}? Its replacement history is kept and it can be restored.`}
                confirmText="Remove part"
                onConfirm={handleRemove}
                variant="destructive"
              />
            </div>
          ) : canWrite && part.isArchived ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <RotateCcw size={16} className="mr-2" aria-hidden="true" /> Restore
                </Button>
              }
              title="Restore this part?"
              description={`Record ${part.partCode} as fitted to ${part.machineCode} again?`}
              confirmText="Restore part"
              onConfirm={handleRestore}
            />
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PageSection title="Component" description="Identity and classification.">
          <dl className="space-y-3">
            <DetailRow label="Part code" value={part.partCode} />
            <DetailRow label="Part name" value={part.partName} />
            <DetailRow label="Category" value={part.category} />
            <DetailRow label="Serial number" value={part.serialNumber} />
            <DetailRow label="Quantity installed" value={`${part.quantity} ${part.unit}`} />
          </dl>
        </PageSection>

        <PageSection title="Fitment" description="Where it sits and when replacement falls due.">
          <dl className="space-y-3">
            <DetailRow
              label="Machine"
              value={
                <Link
                  href={machineDetailPath(part.machineId)}
                  className="font-mono text-primary hover:underline"
                >
                  {part.machineCode}
                </Link>
              }
            />
            <DetailRow label="Position" value={part.positionOnMachine} />
            <DetailRow label="Fitted" value={formatDate(part.fittedDate)} />
            <DetailRow
              label="Expected life"
              value={part.expectedLifeMonths ? `${part.expectedLifeMonths} months` : undefined}
            />
            <DetailRow label="Replacement due" value={dueDate ? formatDate(dueDate) : undefined} />
            <DetailRow label="State" value={<StatusBadge status={lifeState} />} />
            <DetailRow label="Record updated" value={formatDateTime(part.updatedAt)} />
          </dl>
        </PageSection>
      </div>

      {part.notes ? (
        <PageSection title="Notes" description="Maintenance context recorded for this component.">
          <p className="text-sm leading-relaxed text-muted-foreground">{part.notes}</p>
        </PageSection>
      ) : null}

      <PageSection
        title="Replacement history"
        description="Every time this component was replaced, newest first."
      >
        {replacements.length === 0 ? (
          <EmptyState
            icon={History}
            title="No replacements recorded"
            description="This component has not been replaced since it was first fitted."
          />
        ) : (
          <ol className="space-y-4">
            {replacements.map((entry) => (
              <li key={entry.id} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{entry.reason}</p>
                  <time dateTime={entry.replacedOn} className="text-xs font-semibold">
                    {formatDate(entry.replacedOn)}
                  </time>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {entry.previousSerialNumber ? (
                    <div className="flex gap-1">
                      <dt>Removed serial:</dt>
                      <dd className="font-medium">{entry.previousSerialNumber}</dd>
                    </div>
                  ) : null}
                  {entry.newSerialNumber ? (
                    <div className="flex gap-1">
                      <dt>Fitted serial:</dt>
                      <dd className="font-medium">{entry.newSerialNumber}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-1">
                    <dt>By:</dt>
                    <dd className="font-medium">{actorName(entry.performedBy)}</dd>
                  </div>
                </dl>
                {entry.notes ? (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{entry.notes}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </PageSection>
    </div>
  );
}

/** Records a replacement: the component is re-fitted, restarting its life clock. */
function ReplaceDialog({
  partId,
  partCode,
  actorId,
  onReplaced,
}: {
  partId: string;
  partCode: string;
  actorId: string;
  onReplaced: (feedback: FeedbackModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PartReplacementValues>({
    replacedOn: toDateInputValue(new Date().toISOString()),
    reason: '',
    newSerialNumber: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PartReplacementValues, string>>>({});

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const parsed = partReplacementSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof PartReplacementValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in next)) {
          next[field as keyof PartReplacementValues] = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setErrors({});
    const result = mockRepository.replacePart(partId, parsed.data, actorId);

    if (!result.ok) {
      setErrors(result.reason === 'duplicate_serial' ? { newSerialNumber: result.message } : {});
      onReplaced({
        state: 'validation',
        title: 'Replacement not recorded',
        description: result.message,
      });
      if (result.reason !== 'duplicate_serial') setOpen(false);
      return;
    }

    setOpen(false);
    setValues({
      replacedOn: toDateInputValue(new Date().toISOString()),
      reason: '',
      newSerialNumber: '',
      notes: '',
    });
    onReplaced({
      state: 'success',
      title: `${partCode} replaced`,
      description: 'The replacement is recorded and the expected life restarts from this date.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Repeat size={16} className="mr-2" aria-hidden="true" /> Replace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Record a replacement</DialogTitle>
            <DialogDescription>
              Replacing {partCode} restarts its expected life from the replacement date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <MachineFormField
              id="replacement-replacedOn"
              label="Replacement date"
              required
              error={errors.replacedOn}
            >
              <Input
                {...fieldAria('replacement-replacedOn', errors.replacedOn)}
                type="date"
                value={values.replacedOn}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, replacedOn: event.target.value }))
                }
              />
            </MachineFormField>

            <MachineFormField id="replacement-reason" label="Reason" required error={errors.reason}>
              <Input
                {...fieldAria('replacement-reason', errors.reason)}
                value={values.reason}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, reason: event.target.value }))
                }
              />
            </MachineFormField>

            <MachineFormField
              id="replacement-newSerialNumber"
              label="New serial number"
              hint="Must be unique across all parts."
              error={errors.newSerialNumber}
            >
              <Input
                {...fieldAria(
                  'replacement-newSerialNumber',
                  errors.newSerialNumber,
                  'Must be unique across all parts.',
                )}
                value={values.newSerialNumber ?? ''}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, newSerialNumber: event.target.value }))
                }
                autoComplete="off"
              />
            </MachineFormField>

            <MachineFormField id="replacement-notes" label="Notes" error={errors.notes}>
              <Textarea
                {...fieldAria('replacement-notes', errors.notes)}
                rows={3}
                value={values.notes ?? ''}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, notes: event.target.value }))
                }
              />
            </MachineFormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record replacement</Button>
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
