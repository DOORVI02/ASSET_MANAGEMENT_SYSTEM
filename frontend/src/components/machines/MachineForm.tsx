import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  hasFormChanges,
  machineFormStatusOptions,
  machineTypeOptions,
  validateMachineForm,
  type MachineFormErrors,
  type MachineFormValues,
} from '@/lib/machine-form';
import type { Department } from '@/lib/types';

export type MachineFormSubmitResult =
  { ok: true } | { ok: false; message: string; field?: keyof MachineFormValues };

interface MachineFormProps {
  mode: 'create' | 'edit';
  initialValues: MachineFormValues;
  departments: Department[];
  /** Case-insensitive duplicate check against the current register, excluding self. */
  /**
   * Advisory duplicate check, run against the server as the user types.
   *
   * Async since the 2026-07-29 cutover: the answer now comes from the database rather than
   * an in-memory list. It is deliberately *advisory* — the authoritative check is the
   * `machines_code_key` unique constraint, surfaced by `createMachine`/`updateMachine` as a
   * submit error on this field. Any check-then-insert has a window between the two steps
   * that a concurrent database can lose, so this exists to warn early, not to guarantee.
   */
  isCodeTaken: (code: string) => Promise<boolean>;
  onSubmit: (values: MachineFormValues) => Promise<MachineFormSubmitResult>;
  onCancel: () => void;
  /** Machine image UI, rendered inside the form's own section. */
  imageSection?: ReactNode;
}

const statusLabels: Record<MachineFormValues['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  under_maintenance: 'Under maintenance',
  under_repair: 'Under repair',
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function MachineForm({
  mode,
  initialValues,
  departments,
  isCodeTaken,
  onSubmit,
  onCancel,
  imageSection,
}: MachineFormProps) {
  const [values, setValues] = useState<MachineFormValues>(initialValues);
  const [errors, setErrors] = useState<MachineFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof MachineFormValues, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isDirty = useMemo(() => hasFormChanges(values, initialValues), [values, initialValues]);

  // Warn before a browser navigation would discard unsaved edits.
  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      return '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, isSubmitting]);

  /**
   * The code that the server most recently reported as already in use, rather than a plain
   * boolean.
   *
   * Storing the *term* makes the warning derivable, which removes two problems at once: it
   * cannot be left standing against a code the user has since edited, and clearing it needs
   * no synchronous setState in the effect below (which would cascade a render on every
   * keystroke). An answer that arrives for a stale term simply stops matching and stops
   * showing.
   */
  const [takenCode, setTakenCode] = useState<string | null>(null);
  const trimmedCode = values.code.trim();
  const duplicateCode = takenCode !== null && takenCode === trimmedCode;

  /**
   * Debounced, because this is a network round trip since the 2026-07-29 cutover rather than
   * an array scan — one request per keystroke would be wasteful and racy.
   *
   * Errors are swallowed deliberately: this warning is a convenience, and a failed lookup
   * must not block a submit that the database is about to adjudicate correctly anyway.
   */
  useEffect(() => {
    if (trimmedCode.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void isCodeTaken(trimmedCode)
        .then((taken) => {
          if (!cancelled && taken) setTakenCode(trimmedCode);
        })
        .catch(() => undefined);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedCode, isCodeTaken]);

  const setField = useCallback(
    <K extends keyof MachineFormValues>(field: K, value: MachineFormValues[K]) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      setSubmitError(null);
    },
    [],
  );

  const markTouched = useCallback((field: keyof MachineFormValues) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const validationErrors = useMemo(() => validateMachineForm(values), [values]);

  /** Show an error once the field was visited or a submit was attempted. */
  const errorFor = (field: keyof MachineFormValues): string | undefined => {
    if (field === 'code' && duplicateCode && (touched.code || hasAttemptedSubmit)) {
      return 'Another machine already uses this code.';
    }
    if (!touched[field] && !hasAttemptedSubmit) return undefined;
    return validationErrors[field];
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const nextErrors = validateMachineForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || duplicateCode) {
      const firstInvalid = duplicateCode ? 'code' : Object.keys(nextErrors)[0];
      document.getElementById(`machine-${firstInvalid}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      if (result.field) {
        setErrors((previous) => ({ ...previous, [result.field as string]: result.message }));
        document.getElementById(`machine-${result.field}`)?.focus();
      }
    }
  };

  // `errors` holds server-reported failures; live validation covers everything else.
  const combinedError = (field: keyof MachineFormValues): string | undefined =>
    errorFor(field) ?? errors[field];

  const invalidCount = Object.keys(validationErrors).length + (duplicateCode ? 1 : 0);

  const cancelButton =
    isDirty && !isSubmitting ? (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline">
            Cancel
          </Button>
        }
        title="Discard unsaved changes?"
        description="This machine has unsaved edits. Leaving now discards them."
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
            title: mode === 'create' ? 'Machine not created' : 'Changes not saved',
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

      <PageSection title="Identity" description="How this machine is referenced across the plant.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="machine-code"
            label="Machine code"
            required
            hint="Unique plant identifier, for example HP-04."
            error={combinedError('code')}
          >
            <Input
              {...fieldAria(
                'machine-code',
                combinedError('code'),
                'Unique plant identifier, for example HP-04.',
              )}
              value={values.code}
              onChange={(event) => setField('code', event.target.value.toUpperCase())}
              onBlur={() => markTouched('code')}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </MachineFormField>

          <MachineFormField
            id="machine-name"
            label="Machine name"
            required
            error={combinedError('name')}
          >
            <Input
              {...fieldAria('machine-name', combinedError('name'))}
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              onBlur={() => markTouched('name')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-departmentId"
            label="Department"
            required
            error={combinedError('departmentId')}
          >
            <Select
              value={values.departmentId}
              onValueChange={(value) => {
                setField('departmentId', value);
                markTouched('departmentId');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('machine-departmentId', combinedError('departmentId'))}>
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              {/* There are 21 provisional departments. Keep this long list in the same
                  bounded, scrollable Radix menu pattern as the other form selects. */}
              <SelectContent className="max-h-80 custom-scrollbar">
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="machine-type"
            label="Machine type"
            required
            error={combinedError('type')}
          >
            <Select
              value={values.type}
              onValueChange={(value) => setField('type', value as MachineFormValues['type'])}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('machine-type', combinedError('type'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {machineTypeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {titleCase(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="machine-manufacturer"
            label="Manufacturer"
            required
            error={combinedError('manufacturer')}
          >
            <Input
              {...fieldAria('machine-manufacturer', combinedError('manufacturer'))}
              value={values.manufacturer}
              onChange={(event) => setField('manufacturer', event.target.value)}
              onBlur={() => markTouched('manufacturer')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-model"
            label="Model"
            required
            error={combinedError('model')}
          >
            <Input
              {...fieldAria('machine-model', combinedError('model'))}
              value={values.model}
              onChange={(event) => setField('model', event.target.value)}
              onBlur={() => markTouched('model')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-serialNumber"
            label="Serial number"
            hint="Manufacturer serial. Uniqueness is not enforced yet — pending confirmation."
            error={combinedError('serialNumber')}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAria(
                'machine-serialNumber',
                combinedError('serialNumber'),
                'Manufacturer serial. Uniqueness is not enforced yet — pending confirmation.',
              )}
              value={values.serialNumber ?? ''}
              onChange={(event) => setField('serialNumber', event.target.value)}
              onBlur={() => markTouched('serialNumber')}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </MachineFormField>
        </div>
      </PageSection>

      <PageSection
        title="Technical ratings"
        description="Recorded as free text with the unit included until engineering confirms units and ranges."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MachineFormField
            id="machine-capacity"
            label="Capacity"
            hint="e.g. 5000 t"
            error={combinedError('capacity')}
          >
            <Input
              {...fieldAria('machine-capacity', combinedError('capacity'), 'e.g. 5000 t')}
              value={values.capacity ?? ''}
              onChange={(event) => setField('capacity', event.target.value)}
              onBlur={() => markTouched('capacity')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-powerRating"
            label="Power rating"
            hint="e.g. 250 kW"
            error={combinedError('powerRating')}
          >
            <Input
              {...fieldAria('machine-powerRating', combinedError('powerRating'), 'e.g. 250 kW')}
              value={values.powerRating ?? ''}
              onChange={(event) => setField('powerRating', event.target.value)}
              onBlur={() => markTouched('powerRating')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-voltage"
            label="Voltage"
            hint="e.g. 415 V"
            error={combinedError('voltage')}
          >
            <Input
              {...fieldAria('machine-voltage', combinedError('voltage'), 'e.g. 415 V')}
              value={values.voltage ?? ''}
              onChange={(event) => setField('voltage', event.target.value)}
              onBlur={() => markTouched('voltage')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-weight"
            label="Weight"
            hint="e.g. 12 t"
            error={combinedError('weight')}
          >
            <Input
              {...fieldAria('machine-weight', combinedError('weight'), 'e.g. 12 t')}
              value={values.weight ?? ''}
              onChange={(event) => setField('weight', event.target.value)}
              onBlur={() => markTouched('weight')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      <PageSection
        title="Installation and location"
        description="Where the machine sits and when it entered service."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="machine-installationDate"
            label="Installation date"
            required
            error={combinedError('installationDate')}
          >
            <Input
              {...fieldAria('machine-installationDate', combinedError('installationDate'))}
              type="date"
              value={values.installationDate}
              onChange={(event) => setField('installationDate', event.target.value)}
              onBlur={() => markTouched('installationDate')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-nextMaintenanceDate"
            label="Next maintenance date"
            required
            error={combinedError('nextMaintenanceDate')}
          >
            <Input
              {...fieldAria('machine-nextMaintenanceDate', combinedError('nextMaintenanceDate'))}
              type="date"
              value={values.nextMaintenanceDate}
              onChange={(event) => setField('nextMaintenanceDate', event.target.value)}
              onBlur={() => markTouched('nextMaintenanceDate')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-location"
            label="Location"
            required
            hint="Short label shown in the register, for example Bay 3."
            error={combinedError('location')}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAria(
                'machine-location',
                combinedError('location'),
                'Short label shown in the register, for example Bay 3.',
              )}
              value={values.location}
              onChange={(event) => setField('location', event.target.value)}
              onBlur={() => markTouched('location')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-plantArea"
            label="Plant area"
            error={combinedError('plantArea')}
          >
            <Input
              {...fieldAria('machine-plantArea', combinedError('plantArea'))}
              value={values.plantArea ?? ''}
              onChange={(event) => setField('plantArea', event.target.value)}
              onBlur={() => markTouched('plantArea')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-baySection"
            label="Bay or section"
            error={combinedError('baySection')}
          >
            <Input
              {...fieldAria('machine-baySection', combinedError('baySection'))}
              value={values.baySection ?? ''}
              onChange={(event) => setField('baySection', event.target.value)}
              onBlur={() => markTouched('baySection')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField id="machine-floor" label="Floor" error={combinedError('floor')}>
            <Input
              {...fieldAria('machine-floor', combinedError('floor'))}
              value={values.floor ?? ''}
              onChange={(event) => setField('floor', event.target.value)}
              onBlur={() => markTouched('floor')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="machine-roomPosition"
            label="Room or position"
            error={combinedError('roomPosition')}
          >
            <Input
              {...fieldAria('machine-roomPosition', combinedError('roomPosition'))}
              value={values.roomPosition ?? ''}
              onChange={(event) => setField('roomPosition', event.target.value)}
              onBlur={() => markTouched('roomPosition')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      <PageSection
        title="Status and description"
        description="Retirement happens through the audited Archive action, not this field."
      >
        <div className="grid grid-cols-1 gap-4">
          <MachineFormField
            id="machine-status"
            label="Lifecycle status"
            required
            error={combinedError('status')}
            className="sm:max-w-xs"
          >
            <Select
              value={values.status}
              onValueChange={(value) => setField('status', value as MachineFormValues['status'])}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('machine-status', combinedError('status'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {machineFormStatusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="machine-description"
            label="Description"
            hint="Operating notes, known issues, or service context."
            error={combinedError('description')}
          >
            <Textarea
              {...fieldAria(
                'machine-description',
                combinedError('description'),
                'Operating notes, known issues, or service context.',
              )}
              rows={4}
              value={values.description ?? ''}
              onChange={(event) => setField('description', event.target.value)}
              onBlur={() => markTouched('description')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      {imageSection}

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
              {mode === 'create' ? 'Create machine' : 'Save changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
