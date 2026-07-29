import { useCallback, useMemo } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { MachineForm, type MachineFormSubmitResult } from '@/components/machines/MachineForm';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { getMachineInScope, isMachineCodeTaken, updateMachine } from '@/lib/supabase/machines';
import { queryKeys } from '@/lib/supabase/query-keys';
import { useDepartment } from '@/hooks/use-department';
import {
  formValuesToMachineInput,
  machineToFormValues,
  type MachineFormValues,
} from '@/lib/machine-form';
import { machineDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MachineEditPage() {
  const [, params] = useRoute(registeredRoutes.machineEdit);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { scope, available: departments } = useDepartment();
  const machineId = params?.id;

  const {
    data: machine,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.machines.detail(machineId ?? ''),
    queryFn: () => getMachineInScope(machineId ?? '', scope),
    enabled: Boolean(machineId) && scope.departmentIds.length > 0,
  });

  /**
   * Snapshot the form's starting values once, keyed on the machine id alone, so a background
   * refetch of this query cannot reset fields the user is still editing.
   */
  const initialValues = useMemo(
    () => (machine ? machineToFormValues(machine) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machineId],
  );

  // Excludes this machine, so a record keeping its own code is not reported as a duplicate
  // of itself. Advisory only — see the prop's documentation on MachineForm.
  const isCodeTaken = useCallback(
    (code: string) => isMachineCodeTaken(code, machineId),
    [machineId],
  );

  if (!can(user, 'machine:edit')) {
    return <UnauthorizedPage />;
  }

  if (isPending) {
    return (
      <div className="max-w-2xl">
        <LoadingState label="Loading machine…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl">
        <ErrorState
          title="Could not load this machine"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  /**
   * Reached only once the query has resolved successfully, so this is genuinely "no such
   * machine in your scope" rather than "not loaded yet". The preview could not draw that
   * distinction: a synchronous repository had no loading state to be in, so a missing record
   * and an unfetched one looked identical.
   */
  if (!machine || !initialValues) {
    return (
      <div className="max-w-2xl">
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

  const handleSubmit = async (values: MachineFormValues): Promise<MachineFormSubmitResult> => {
    const result = await updateMachine(machine.id, formValuesToMachineInput(values));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'duplicate_code' ? 'code' : undefined,
      };
    }

    await queryClient.invalidateQueries({ queryKey: ['machines'] });
    setLocation(machineDetailPath(machine.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={machineDetailPath(machine.id)}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to {machine.code}
        </Button>
      </Link>

      <PageHeader
        title={`Edit ${machine.code}`}
        description={`Update the master record for ${machine.name}.`}
      />

      {machine.isArchived ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This machine is archived',
            description:
              'Archived machines are read-only. Restore it from the machine detail page before editing.',
          }}
        />
      ) : null}

      {machine.isArchived ? null : (
        <MachineForm
          mode="edit"
          initialValues={initialValues}
          departments={departments}
          isCodeTaken={isCodeTaken}
          onSubmit={handleSubmit}
          onCancel={() => setLocation(machineDetailPath(machine.id))}
        />
      )}
    </div>
  );
}
