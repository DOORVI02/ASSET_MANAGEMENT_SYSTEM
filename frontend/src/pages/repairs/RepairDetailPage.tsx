import { useState, type ReactNode } from 'react';
import { ArrowLeft, Pencil, Play, Trash2, Wrench, XCircle } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import {
  repairCompletionSchema,
  repairCancellationSchema,
  type RepairCompletionValues,
} from '@/lib/repair-form';
import { isOpenRepair } from '@/lib/repair-record';
import { machineDetailPath, registeredRoutes, repairEditPath } from '@/lib/routes';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRepairRecord,
  completeRepairRecord,
  getRepairRecordInScope,
  listRepairAttachments,
  startRepairRecord,
  waitForRepairParts,
} from '@/lib/supabase/repairs';
import { deleteCloudinaryAttachment, uploadAndFinalizeImage } from '@/lib/supabase/attachments';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import type { FeedbackMessage as FeedbackModel } from '@/lib/types';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function RepairDetailPage() {
  const [, params] = useRoute(registeredRoutes.repairDetail);
  const { user } = useAuth();
  const { scope } = useDepartment();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);
  const repairId = params?.id;
  const { data: repair, isPending } = useQuery({
    queryKey: queryKeys.repairs.detail(repairId ?? ''),
    queryFn: () => getRepairRecordInScope(repairId ?? '', scope),
    enabled: Boolean(repairId) && scope.departmentIds.length > 0,
  });

  const { data: evidence = [] } = useQuery({
    queryKey: [...queryKeys.repairs.detail(repairId ?? ''), 'attachments'],
    queryFn: () => listRepairAttachments(repairId ?? ''),
    enabled: Boolean(repairId) && scope.departmentIds.length > 0,
  });
  const canEdit = can(user, 'repair:edit');
  if (!can(user, 'repair:view')) return <UnauthorizedPage />;
  if (isPending)
    return (
      <div className="mx-auto max-w-2xl">
        <LoadingState label="Loading repair…" />
      </div>
    );
  if (!repair)
    return (
      // `mx-auto` matches the other three detail pages' not-found state. Without it,
      // this narrower div stuck to the left edge of the shell's max-w-7xl container
      // instead of centering, while the machine/part/maintenance equivalents did.
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Repair record not found"
          description="This repair is unavailable in the current department."
          action={
            <Link href={registeredRoutes.repairs}>
              <Button variant="outline">Back to repairs</Button>
            </Link>
          }
        />
      </div>
    );
  const open = isOpenRepair(repair);
  const invoke = async (
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ) => {
    const result = await action();
    // Refetch on both outcomes: a rejected transition usually means the record already
    // moved on, and showing the stale status next to "not updated" is what makes that
    // confusing rather than informative.
    await queryClient.invalidateQueries({ queryKey: ['repairs'] });
    setFeedback(
      result.ok
        ? { state: 'success', title: 'Repair updated', description: 'The repair record has been updated.' }
        : { state: 'validation', title: 'Repair not updated', description: result.message },
    );
  };
  /**
   * Deletes the Cloudinary asset and its `attachments` row together, through
   * `cloudinary-delete`. Removing only the row would orphan the asset in Cloudinary —
   * exactly the drift `reconcile-cloudinary-orphans.mjs` exists to find.
   */
  const removeEvidence = async (attachmentId: string) => {
    try {
      await deleteCloudinaryAttachment(attachmentId);
      await queryClient.invalidateQueries({ queryKey: ['repairs'] });
      setFeedback({
        state: 'success',
        title: 'Evidence removed',
        description: 'The image was deleted from this repair.',
      });
    } catch (deleteError) {
      setFeedback({
        state: 'validation',
        title: 'Could not remove image',
        description:
          deleteError instanceof Error ? deleteError.message : 'The image could not be removed.',
      });
    }
  };

  const upload = async (file: File) => {
    // The full sign -> upload -> finalize sequence. A `URL.createObjectURL` blob, which is
    // what this used to store, is meaningless outside the tab that created it — writing one
    // to the database would produce a row that renders as a broken image everywhere else.
    try {
      await uploadAndFinalizeImage({ entityType: 'repair', entityId: repair.id, file });
      await queryClient.invalidateQueries({ queryKey: ['repairs'] });
      setFeedback({
        state: 'success',
        title: 'Evidence added',
        description: `${file.name} was uploaded to this repair.`,
      });
    } catch (uploadError) {
      setFeedback({
        state: 'validation',
        title: 'Upload failed',
        description: uploadError instanceof Error ? uploadError.message : 'The image could not be uploaded.',
      });
    }
  };
  return (
    <div className="max-w-6xl space-y-6">
      <Link href={registeredRoutes.repairs}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
          Back to repairs
        </Button>
      </Link>
      <PageHeader
        title={`Repair — ${repair.machineCode}`}
        description={repair.machineName}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && open ? (
              <Link href={repairEditPath(repair.id)}>
                <Button variant="outline">
                  <Pencil size={16} className="mr-2" aria-hidden="true" />
                  Edit
                </Button>
              </Link>
            ) : null}
            {canEdit && repair.status === 'reported' ? (
              <Button
                onClick={() =>
                  invoke(() => startRepairRecord(repair.id))
                }
              >
                <Play size={16} className="mr-2" aria-hidden="true" />
                Start
              </Button>
            ) : null}
            {canEdit && repair.status === 'waiting_for_parts' ? (
              <Button
                onClick={() =>
                  invoke(() => startRepairRecord(repair.id))
                }
              >
                <Play size={16} className="mr-2" aria-hidden="true" />
                Resume
              </Button>
            ) : null}
            {canEdit && repair.status === 'in_progress' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    invoke(() =>
                      waitForRepairParts(repair.id),
                    )
                  }
                >
                  Waiting for parts
                </Button>
                <CompleteDialog
                  repairId={repair.id}
                  onResult={setFeedback}
                />
              </>
            ) : null}
            {canEdit && open ? (
              <CancelDialog
                repairId={repair.id}
                onResult={setFeedback}
              />
            ) : null}
          </div>
        }
      />
      {feedback ? <FeedbackMessage feedback={feedback} /> : null}
      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'Repair state and evidence reset on page reload. Cloudinary delivery comes only in the approved backend phase.',
        }}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Repair report</h2>
              <StatusBadge status={repair.status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Item label="Machine">
                <Link
                  className="text-primary hover:underline"
                  href={machineDetailPath(repair.machineId)}
                >
                  {repair.machineCode} — {repair.machineName}
                </Link>
              </Item>
              <Item label="Reported">
                {formatDate(repair.reportedDate)} by {repair.reportedBy}
              </Item>
              <Item label="Assigned to">{repair.assignedTo ?? 'Unassigned'}</Item>
              <Item label="Started">
                {repair.startDate ? formatDateTime(repair.startDate) : 'Not started'}
              </Item>
              <Item label="Problem" wide>
                {repair.description}
              </Item>
              <Item label="Diagnosis" wide>
                {repair.diagnosis ?? 'Not yet recorded'}
              </Item>
              <Item label="Action / resolution" wide>
                {repair.resolution ?? 'Not yet recorded'}
              </Item>
            </dl>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Work and closure</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <Item label="Parts used">{repair.partsUsed ?? '—'}</Item>
              <Item label="Downtime">
                {repair.downtimeHours === undefined ? '—' : `${repair.downtimeHours} hours`}
              </Item>
              <Item label="Completed">
                {repair.completedDate ? formatDateTime(repair.completedDate) : 'Not completed'}
              </Item>
              <Item label="Remarks" wide>
                {repair.remarks ?? '—'}
              </Item>
            </dl>
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Evidence images</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add several fault or repair photos in this browser-only preview.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {evidence.map((attachment) => (
                <div key={attachment.id} className="group relative overflow-hidden rounded border">
                  <img
                    src={attachment.url}
                    alt={`Repair evidence: ${attachment.fileName}`}
                    className="h-28 w-full object-cover"
                  />
                  {canEdit && open ? (
                    <ConfirmDialog
                      trigger={
                        <Button
                          className="absolute right-1 top-1 opacity-0 group-hover:opacity-100"
                          size="icon"
                          variant="destructive"
                          aria-label={`Remove ${attachment.fileName}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      }
                      title="Remove evidence image?"
                      description={`Remove ${attachment.fileName} from this repair?`}
                      confirmText="Remove image"
                      onConfirm={() =>
                        void removeEvidence(attachment.id)
                      }
                      variant="destructive"
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {!evidence.length ? (
              <p className="mt-4 text-sm text-muted-foreground">No evidence images yet.</p>
            ) : null}
            {canEdit && open ? (
              <div className="mt-4">
                <ImageUploader key={`${repair.id}-${evidence.length}`} onUpload={upload} />
                <p className="mt-2 text-xs text-muted-foreground">
                  JPEG, PNG, or AVIF, up to 5 MB each.
                </p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Item({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{children}</dd>
    </div>
  );
}

function CompleteDialog({
  repairId,
  onResult,
}: {
  repairId: string;
  onResult: (feedback: FeedbackModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<RepairCompletionValues>({
    diagnosis: '',
    resolution: '',
    downtimeHours: undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const complete = async () => {
    const parsed = repairCompletionSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the completion fields.');
      return;
    }
    const result = await completeRepairRecord(repairId, parsed.data);
    if (result.ok) {
      setOpen(false);
      onResult({
        state: 'success',
        title: 'Repair completed',
        description: 'Diagnosis, resolution, and status were saved to the preview store.',
      });
    } else setError(result.message);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Wrench size={16} className="mr-2" aria-hidden="true" />
          Complete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete repair</DialogTitle>
          <DialogDescription>
            Diagnosis and resolution are required to close this repair.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Diagnosis
            <Textarea
              className="mt-1"
              value={values.diagnosis}
              onChange={(event) => setValues({ ...values, diagnosis: event.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Resolution
            <Textarea
              className="mt-1"
              value={values.resolution}
              onChange={(event) => setValues({ ...values, resolution: event.target.value })}
            />
          </label>
          <div>
            <label className="text-sm font-medium">
              Downtime hours
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={values.downtimeHours ?? ''}
                onChange={(event) =>
                  setValues({
                    ...values,
                    downtimeHours: event.target.value ? event.target.valueAsNumber : undefined,
                  })
                }
              />
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={complete}>Mark completed</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  repairId,
  onResult,
}: {
  repairId: string;
  onResult: (feedback: FeedbackModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    const parsed = repairCancellationSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a reason.');
      return;
    }
    const result = await cancelRepairRecord(repairId, parsed.data.reason);
    if (result.ok) {
      setOpen(false);
      onResult({
        state: 'success',
        title: 'Repair cancelled',
        description: 'The cancellation was saved to the preview store.',
      });
    } else setError(result.message);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <XCircle size={16} className="mr-2" aria-hidden="true" />
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel repair</DialogTitle>
          <DialogDescription>Record why this open repair is being cancelled.</DialogDescription>
        </DialogHeader>
        <label className="block text-sm font-medium">
          Reason
          <Textarea
            className="mt-1"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="destructive" onClick={cancel}>
            Cancel repair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
