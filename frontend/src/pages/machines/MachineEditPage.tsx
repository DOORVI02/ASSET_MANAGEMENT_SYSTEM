import { useCallback, useMemo } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { MachineForm, type MachineFormSubmitResult } from '@/components/machines/MachineForm';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { mockRepository } from '@/lib/mock-repository';
import { useMockRepository } from '@/hooks/use-mock-repository';
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
  const repository = useMockRepository();
  const { scope } = useDepartment();
  const machineId = params?.id;

  const departments = useMemo(() => repository.listDepartments(), [repository]);
  const machine = useMemo(
    () => (machineId ? repository.getMachineInScope(machineId, scope) : undefined),
    [machineId, repository, scope],
  );

  // Snapshot the form's starting values once so later repository writes do not
  // reset fields the user is still editing.
  const initialValues = useMemo(
    () => (machine ? machineToFormValues(machine) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machineId],
  );

  // Reads the singleton directly so the check always sees the latest register.
  const isCodeTaken = useCallback(
    (code: string) => mockRepository.isMachineCodeTaken(code, machineId),
    [machineId],
  );

  if (!can(user, 'machine:edit')) {
    return <UnauthorizedPage />;
  }

  if (!machine || !initialValues) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title="Machine not found"
          description={`No machine matches the identifier "${machineId ?? ''}". It may have been removed from the register.`}
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
    const result = mockRepository.updateMachine(
      machine.id,
      formValuesToMachineInput(values),
      user?.id ?? 'unknown',
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'duplicate_code' ? 'code' : undefined,
      };
    }

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
      ) : (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'Preview mode — data is not persisted',
            description:
              'Edits are saved to the in-memory preview store and reset on page reload. Supabase persistence arrives in a later phase.',
          }}
        />
      )}

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
