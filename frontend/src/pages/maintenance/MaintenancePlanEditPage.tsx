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
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveMaintenancePlan,
  getMaintenancePlanInScope,
  restoreMaintenancePlan,
  updateMaintenancePlan,
} from '@/lib/supabase/maintenance';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listTechnicians } from '@/lib/supabase/technicians';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const planId = params?.id;

  const { data: plan, isPending } = useQuery({
    queryKey: queryKeys.maintenance.planDetail(planId ?? ''),
    queryFn: () => getMaintenancePlanInScope(planId ?? '', scope),
    enabled: Boolean(planId) && scope.departmentIds.length > 0,
  });
  const { data: machinesInScope = [] } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), current?.id ?? ''],
    queryFn: () => listAllMachinesInScope(scope, current?.id),
    enabled: Boolean(current) && scope.departmentIds.length > 0,
  });
  const machines = useMemo(
    () => machinesInScope.filter((machine) => !machine.isArchived),
    [machinesInScope],
  );
  const { data: technicians = [] } = useQuery({
    queryKey: queryKeys.technicians.list(),
    queryFn: listTechnicians,
  });

  const initialValues = useMemo(
    () => (plan ? maintenancePlanToFormValues(plan) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId],
  );

  if (!can(user, 'maintenance:edit')) {
    return <UnauthorizedPage />;
  }

  if (isPending) {
    return (
      <div className="max-w-2xl">
        <LoadingState label="Loading maintenance plan…" />
      </div>
    );
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
    const result = await updateMaintenancePlan(plan.id, formValuesToMaintenancePlanInput(values));

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

  const handleArchive = async () => {
    await archiveMaintenancePlan(plan.id);
    await queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    setLocation(maintenancePath({ view: 'plans' }));
  };

  const handleRestore = async () => {
    await restoreMaintenancePlan(plan.id);
    await queryClient.invalidateQueries({ queryKey: ['maintenance'] });
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
