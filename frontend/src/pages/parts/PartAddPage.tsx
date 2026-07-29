import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { PartForm, type PartFormSubmitResult } from '@/components/parts/PartForm';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import { emptyPartFormValues, formValuesToPartInput, type PartFormValues } from '@/lib/part-form';
import { partDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function PartAddPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // A machine can be preselected when arriving from a machine's Parts tab.
  const presetMachineId = useMemo(
    () => new URLSearchParams(searchString).get('machine') ?? '',
    [searchString],
  );
  const [initialValues] = useState<PartFormValues>(() => emptyPartFormValues(presetMachineId));

  const machines = useMemo(
    () =>
      current
        ? repository.listMachinesForDepartment(current.id, scope).filter((m) => !m.isArchived)
        : [],
    [current, repository, scope],
  );

  const isSerialTaken = useCallback(
    (serialNumber: string) => mockRepository.isPartSerialTaken(serialNumber),
    [],
  );

  if (!can(user, 'parts:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (values: PartFormValues): Promise<PartFormSubmitResult> => {
    const result = mockRepository.createPart(formValuesToPartInput(values), user?.id ?? 'unknown');

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field:
          result.reason === 'duplicate_serial'
            ? 'serialNumber'
            : result.reason === 'unknown_machine'
              ? 'machineId'
              : undefined,
      };
    }

    setLocation(partDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.parts}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to parts
        </Button>
      </Link>

      <PageHeader
        title="Fit part"
        description="Record a component fitted to a machine in this department."
      />

      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'This part is saved to the in-memory preview store and resets on page reload. Supabase persistence arrives in a later phase.',
        }}
      />

      {machines.length === 0 ? (
        <EmptyState
          title="No machines available"
          description="This department has no active machines to fit a component to."
        />
      ) : (
        <PartForm
          mode="create"
          initialValues={initialValues}
          machines={machines}
          isSerialTaken={isSerialTaken}
          onSubmit={handleSubmit}
          onCancel={() => setLocation(registeredRoutes.parts)}
        />
      )}
    </div>
  );
}
