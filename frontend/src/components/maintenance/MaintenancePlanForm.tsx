import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  hasMaintenancePlanFormChanges,
  maintenanceTypeOptions,
  recurrenceUnitOptions,
  validateMaintenancePlanForm,
  type MaintenancePlanFormErrors,
  type MaintenancePlanFormValues,
} from '@/lib/maintenance-form';
import type { Machine } from '@/lib/types';
import type { Technician } from '@/lib/mock-data';

export type MaintenancePlanFormSubmitResult =
  { ok: true } | { ok: false; message: string; field?: keyof MaintenancePlanFormValues };

interface MaintenancePlanFormProps {
  mode: 'create' | 'edit';
  initialValues: MaintenancePlanFormValues;
  machines: Machine[];
  technicians: Technician[];
  onSubmit: (values: MaintenancePlanFormValues) => Promise<MaintenancePlanFormSubmitResult>;
  onCancel: () => void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function MaintenancePlanForm({
  mode,
  initialValues,
  machines,
  technicians,
  onSubmit,
  onCancel,
}: MaintenancePlanFormProps) {
  const [values, setValues] = useState<MaintenancePlanFormValues>(initialValues);
  const [errors, setErrors] = useState<MaintenancePlanFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof MaintenancePlanFormValues, boolean>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isDirty = useMemo(
    () => hasMaintenancePlanFormChanges(values, initialValues),
    [values, initialValues],
  );
  const validationErrors = useMemo(() => validateMaintenancePlanForm(values), [values]);

  const setField = useCallback(
    <K extends keyof MaintenancePlanFormValues>(field: K, value: MaintenancePlanFormValues[K]) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      setSubmitError(null);
    },
    [],
  );

  const markTouched = useCallback((field: keyof MaintenancePlanFormValues) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const combinedError = (field: keyof MaintenancePlanFormValues): string | undefined =>
    (touched[field] || hasAttemptedSubmit ? validationErrors[field] : undefined) ?? errors[field];

  const invalidCount = Object.keys(validationErrors).length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const nextErrors = validateMaintenancePlanForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`plan-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      if (result.field) {
        setErrors((previous) => ({ ...previous, [result.field as string]: result.message }));
        document.getElementById(`plan-${result.field}`)?.focus();
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
        description="This plan has unsaved edits. Leaving now discards them."
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
            title: mode === 'create' ? 'Plan not created' : 'Changes not saved',
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

      <PageSection
        title="Recurring definition"
        description="What repeats, on what machine, and how often. This is the plan, not a performed record."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="plan-machineId"
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
              <SelectTrigger {...fieldAria('plan-machineId', combinedError('machineId'))}>
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

          <MachineFormField id="plan-type" label="Type" required error={combinedError('type')}>
            <Select
              value={values.type}
              onValueChange={(value) =>
                setField('type', value as MaintenancePlanFormValues['type'])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('plan-type', combinedError('type'))}>
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
            id="plan-intervalValue"
            label="Repeat every"
            required
            error={combinedError('intervalValue')}
          >
            <Input
              {...fieldAria('plan-intervalValue', combinedError('intervalValue'))}
              type="number"
              min={1}
              value={Number.isNaN(values.intervalValue) ? '' : values.intervalValue}
              onChange={(event) => setField('intervalValue', event.target.valueAsNumber)}
              onBlur={() => markTouched('intervalValue')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="plan-intervalUnit"
            label="Interval unit"
            required
            error={combinedError('intervalUnit')}
          >
            <Select
              value={values.intervalUnit}
              onValueChange={(value) =>
                setField('intervalUnit', value as MaintenancePlanFormValues['intervalUnit'])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('plan-intervalUnit', combinedError('intervalUnit'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recurrenceUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {titleCase(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="plan-technicianId"
            label="Default technician"
            error={combinedError('technicianId')}
          >
            <Select
              value={values.technicianId || undefined}
              onValueChange={(value) => {
                const technician = technicians.find((candidate) => candidate.id === value);
                setField('technicianId', value);
                setField('technicianName', technician?.name ?? '');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('plan-technicianId', combinedError('technicianId'))}>
                <SelectValue placeholder="None" />
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
            id="plan-description"
            label="Description"
            required
            error={combinedError('description')}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAria('plan-description', combinedError('description'))}
              rows={3}
              value={values.description}
              onChange={(event) => setField('description', event.target.value)}
              onBlur={() => markTouched('description')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="plan-isActive"
              checked={values.isActive}
              onCheckedChange={(checked) => setField('isActive', checked)}
              disabled={isSubmitting}
            />
            <label htmlFor="plan-isActive" className="text-sm">
              Plan is active and expected to recur
            </label>
          </div>
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
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" aria-hidden="true" />
              {mode === 'create' ? 'Create plan' : 'Save changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
