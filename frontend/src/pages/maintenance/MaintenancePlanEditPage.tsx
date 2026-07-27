import { useMemo } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  MaintenancePlanForm,
  type MaintenancePlanFormSubmitResult,
} from '@/components/maintenance/MaintenancePlanForm';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import {
  formValuesToMaintenancePlanInput,
  maintenancePlanToFormValues,
  type MaintenancePlanFormValues,
} from '@/lib/maintenance-form';
import { maintenancePath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MaintenancePlanEditPage() {
  const [, params] = useRoute(registeredRoutes.maintenancePlanEdit);
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const planId = params?.id;

  const plan = useMemo(
    () => (planId ? repository.getMaintenancePlanInScope(planId, scope) : undefined),
    [planId, repository, scope],
  );
  const machines = useMemo(
    () =>
      current
        ? repository.listMachinesForDepartment(current.id, scope).filter((m) => !m.isArchived)
        : [],
    [current, repository, scope],
  );
  const technicians = useMemo(() => repository.listTechnicians(), [repository]);

  const initialValues = useMemo(
    () => (plan ? maintenancePlanToFormValues(plan) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId],
  );

  if (!can(user, 'maintenance:edit')) {
    return <UnauthorizedPage />;
  }

  if (!plan || !initialValues) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title="Plan not found"
          description={`No maintenance plan matches the identifier "${planId ?? ''}".`}
          action={
            <Link href={maintenancePath({ view: 'plans' })}>
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to plans
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async (
    values: MaintenancePlanFormValues,
  ): Promise<MaintenancePlanFormSubmitResult> => {
    const result = mockRepository.updateMaintenancePlan(
      plan.id,
      formValuesToMaintenancePlanInput(values),
      user?.id ?? 'unknown',
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    }

    setLocation(maintenancePath({ view: 'plans' }));
    return { ok: true };
  };

  const handleArchive = () => {
    mockRepository.archiveMaintenancePlan(plan.id, user?.id ?? 'unknown');
    setLocation(maintenancePath({ view: 'plans' }));
  };

  const handleRestore = () => {
    mockRepository.restoreMaintenancePlan(plan.id, user?.id ?? 'unknown');
  };

  return (
    // See MaintenancePlanAddPage: matches every other add/edit page's width.
    <div className="max-w-5xl space-y-6">
      <Link href={maintenancePath({ view: 'plans' })}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to plans
        </Button>
      </Link>

      <PageHeader
        title={`Edit ${plan.type} plan`}
        description={`Recurring maintenance definition for ${plan.machineCode}.`}
        actions={
          plan.isArchived ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <RotateCcw size={16} className="mr-2" aria-hidden="true" /> Restore
                </Button>
              }
              title="Restore this plan?"
              description={`Restore the recurring ${plan.type} plan on ${plan.machineCode}?`}
              confirmText="Restore plan"
              onConfirm={handleRestore}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <Trash2 size={16} className="mr-2" aria-hidden="true" /> Archive plan
                </Button>
              }
              title="Archive this plan?"
              description="The plan is kept for history but no longer expected to recur. You can restore it later."
              confirmText="Archive plan"
              onConfirm={handleArchive}
              variant="destructive"
            />
          )
        }
      />

      {plan.isArchived ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This plan is archived',
            description: 'Archived plans are read-only. Restore it to make changes.',
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
          <MaintenancePlanForm
            mode="edit"
            initialValues={initialValues}
            machines={machines}
            technicians={technicians}
            onSubmit={handleSubmit}
            onCancel={() => setLocation(maintenancePath({ view: 'plans' }))}
          />
        </>
      )}
    </div>
  );
}
