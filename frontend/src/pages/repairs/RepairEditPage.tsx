import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  RepairRecordForm,
  type RepairRecordFormSubmitResult,
} from '@/components/repairs/RepairRecordForm';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/lib/mock-auth';
import { mockRepository } from '@/lib/mock-repository';
import { can } from '@/lib/permissions';
import {
  formValuesToRepairRecordInput,
  repairRecordToFormValues,
  type RepairRecordFormValues,
} from '@/lib/repair-form';
import { isOpenRepair } from '@/lib/repair-record';
import { registeredRoutes, repairDetailPath } from '@/lib/routes';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function RepairEditPage() {
  const [, params] = useRoute(registeredRoutes.repairEdit);
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const repairId = params?.id;
  const repair = useMemo(
    () => (repairId ? repository.getRepairRecordInScope(repairId, scope) : undefined),
    [repairId, repository, scope],
  );
  const machines = useMemo(
    () =>
      current
        ? repository
            .listMachinesForDepartment(current.id, scope)
            .filter((machine) => !machine.isArchived)
        : [],
    [current, repository, scope],
  );
  const values = useMemo(() => (repair ? repairRecordToFormValues(repair) : null), [repair]);
  if (!can(user, 'repair:edit')) return <UnauthorizedPage />;
  if (!repair || !values)
    return (
      <div className="max-w-2xl">
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
  const submit = async (next: RepairRecordFormValues): Promise<RepairRecordFormSubmitResult> => {
    const result = mockRepository.updateRepairRecord(
      repair.id,
      formValuesToRepairRecordInput(next),
      user?.id ?? 'unknown',
    );
    if (!result.ok)
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    setLocation(repairDetailPath(repair.id));
    return { ok: true };
  };
  return (
    <div className="max-w-5xl space-y-6">
      <Link href={repairDetailPath(repair.id)}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
          Back to repair
        </Button>
      </Link>
      <PageHeader
        title={`Edit repair — ${repair.machineCode}`}
        description="Update the open repair report and work details."
      />
      {!isOpenRepair(repair) ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This repair is closed',
            description: 'Completed and cancelled repairs are read-only.',
          }}
        />
      ) : (
        <>
          <FeedbackMessage
            feedback={{
              state: 'validation',
              title: 'Preview mode — data is not persisted',
              description:
                'Edits are saved to the in-memory preview store and reset on page reload.',
            }}
          />
          <RepairRecordForm
            mode="edit"
            initialValues={values}
            machines={machines}
            onSubmit={submit}
            onCancel={() => setLocation(repairDetailPath(repair.id))}
          />
        </>
      )}
    </div>
  );
}
