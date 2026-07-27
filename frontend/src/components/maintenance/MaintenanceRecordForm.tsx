import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageSection } from '@/components/shared/PageSection';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MachineFormField } from '@/components/machines/MachineFormField';
import { fieldAria } from '@/lib/form-aria';
import {
  hasMaintenanceRecordFormChanges,
  maintenanceTypeOptions,
  validateMaintenanceRecordForm,
  type MaintenanceRecordFormErrors,
  type MaintenanceRecordFormValues,
} from '@/lib/maintenance-form';
import type { Machine } from '@/lib/types';
import type { Technician } from '@/lib/mock-data';

export type MaintenanceRecordFormSubmitResult =
  { ok: true } | { ok: false; message: string; field?: keyof MaintenanceRecordFormValues };

interface MaintenanceRecordFormProps {
  mode: 'create' | 'edit';
  initialValues: MaintenanceRecordFormValues;
  /** Machines the user may log maintenance against, already department-scoped. */
  machines: Machine[];
  technicians: Technician[];
  onSubmit: (values: MaintenanceRecordFormValues) => Promise<MaintenanceRecordFormSubmitResult>;
  onCancel: () => void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function MaintenanceRecordForm({
  mode,
  initialValues,
  machines,
  technicians,
  onSubmit,
  onCancel,
}: MaintenanceRecordFormProps) {
  const [values, setValues] = useState<MaintenanceRecordFormValues>(initialValues);
  const [errors, setErrors] = useState<MaintenanceRecordFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof MaintenanceRecordFormValues, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isDirty = useMemo(
    () => hasMaintenanceRecordFormChanges(values, initialValues),
    [values, initialValues],
  );
  const validationErrors = useMemo(() => validateMaintenanceRecordForm(values), [values]);

  const setField = useCallback(
    <K extends keyof MaintenanceRecordFormValues>(
      field: K,
      value: MaintenanceRecordFormValues[K],
    ) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      setSubmitError(null);
    },
    [],
  );

  const markTouched = useCallback((field: keyof MaintenanceRecordFormValues) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const combinedError = (field: keyof MaintenanceRecordFormValues): string | undefined =>
    (touched[field] || hasAttemptedSubmit ? validationErrors[field] : undefined) ?? errors[field];

  const invalidCount = Object.keys(validationErrors).length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const nextErrors = validateMaintenanceRecordForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`maintenance-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      if (result.field) {
        setErrors((previous) => ({ ...previous, [result.field as string]: result.message }));
        document.getElementById(`maintenance-${result.field}`)?.focus();
      }
    }
  };

  const cancelButton =
    isDirty && !isSubmitting ? (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline">
            Cancel
          </Button>
        }
        title="Discard unsaved changes?"
        description="This maintenance record has unsaved edits. Leaving now discards them."
        confirmText="Discard changes"
        cancelText="Keep editing"
        onConfirm={onCancel}
        variant="destructive"
      />
    ) : (
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {submitError ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: mode === 'create' ? 'Maintenance not scheduled' : 'Changes not saved',
            description: submitError,
          }}
        />
      ) : null}

      {hasAttemptedSubmit && invalidCount > 0 ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: `${invalidCount} field${invalidCount === 1 ? '' : 's'} need attention`,
            description: 'Correct the highlighted fields below, then save again.',
          }}
        />
      ) : null}

      <PageSection title="What and where" description="The machine and type of maintenance.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="maintenance-machineId"
            label="Machine"
            required
            error={combinedError('machineId')}
          >
            <Select
              value={values.machineId}
              onValueChange={(value) => {
                setField('machineId', value);
                markTouched('machineId');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('maintenance-machineId', combinedError('machineId'))}>
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.code} — {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="maintenance-type"
            label="Type"
            required
            error={combinedError('type')}
          >
            <Select
              value={values.type}
              onValueChange={(value) =>
                setField('type', value as MaintenanceRecordFormValues['type'])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('maintenance-type', combinedError('type'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {maintenanceTypeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {titleCase(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="maintenance-scheduledDate"
            label="Scheduled date"
            required
            error={combinedError('scheduledDate')}
          >
            <Input
              {...fieldAria('maintenance-scheduledDate', combinedError('scheduledDate'))}
              type="date"
              value={values.scheduledDate}
              onChange={(event) => setField('scheduledDate', event.target.value)}
              onBlur={() => markTouched('scheduledDate')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="maintenance-technicianId"
            label="Technician"
            required
            error={combinedError('technicianId')}
          >
            <Select
              value={values.technicianId}
              onValueChange={(value) => {
                const technician = technicians.find((candidate) => candidate.id === value);
                setField('technicianId', value);
                setField('technicianName', technician?.name ?? '');
                markTouched('technicianId');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger
                {...fieldAria('maintenance-technicianId', combinedError('technicianId'))}
              >
                <SelectValue placeholder="Select a technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {technician.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="maintenance-description"
            label="Description"
            required
            hint="What work is planned or was performed."
            error={combinedError('description')}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAria(
                'maintenance-description',
                combinedError('description'),
                'What work is planned or was performed.',
              )}
              rows={3}
              value={values.description}
              onChange={(event) => setField('description', event.target.value)}
              onBlur={() => markTouched('description')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      <PageSection
        title="Work details"
        description="Optional detail captured while scheduling, or filled in as the work proceeds."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="maintenance-findings"
            label="Findings"
            error={combinedError('findings')}
          >
            <Textarea
              {...fieldAria('maintenance-findings', combinedError('findings'))}
              rows={3}
              value={values.findings ?? ''}
              onChange={(event) => setField('findings', event.target.value)}
              onBlur={() => markTouched('findings')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="maintenance-actions"
            label="Actions"
            error={combinedError('actions')}
          >
            <Textarea
              {...fieldAria('maintenance-actions', combinedError('actions'))}
              rows={3}
              value={values.actions ?? ''}
              onChange={(event) => setField('actions', event.target.value)}
              onBlur={() => markTouched('actions')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="maintenance-partsUsed"
            label="Parts used"
            hint="Free text; not linked to installed-part records."
            error={combinedError('partsUsed')}
          >
            <Input
              {...fieldAria(
                'maintenance-partsUsed',
                combinedError('partsUsed'),
                'Free text; not linked to installed-part records.',
              )}
              value={values.partsUsed ?? ''}
              onChange={(event) => setField('partsUsed', event.target.value)}
              onBlur={() => markTouched('partsUsed')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="maintenance-durationHours"
            label="Duration (hours)"
            error={combinedError('durationHours')}
          >
            <Input
              {...fieldAria('maintenance-durationHours', combinedError('durationHours'))}
              type="number"
              min={0}
              step="0.5"
              value={values.durationHours ?? ''}
              onChange={(event) =>
                setField(
                  'durationHours',
                  event.target.value === '' ? undefined : event.target.valueAsNumber,
                )
              }
              onBlur={() => markTouched('durationHours')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="maintenance-remarks"
            label="Remarks"
            error={combinedError('remarks')}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAria('maintenance-remarks', combinedError('remarks'))}
              rows={2}
              value={values.remarks ?? ''}
              onChange={(event) => setField('remarks', event.target.value)}
              onBlur={() => markTouched('remarks')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted-foreground sm:mr-auto" role="status">
          {isDirty ? 'Unsaved changes' : 'No unsaved changes'}
        </p>
        {cancelButton}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {mode === 'create' ? 'Scheduling…' : 'Saving…'}
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" aria-hidden="true" />
              {mode === 'create' ? 'Schedule maintenance' : 'Save changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
