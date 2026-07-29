import { useCallback, useMemo } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { PartForm, type PartFormSubmitResult } from '@/components/parts/PartForm';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPartInScope, isPartSerialTaken, updatePart } from '@/lib/supabase/parts';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
import { formValuesToPartInput, partToFormValues, type PartFormValues } from '@/lib/part-form';
import { partDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function PartEditPage() {
  const [, params] = useRoute(registeredRoutes.partEdit);
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const partId = params?.id;

  const { data: part, isPending } = useQuery({
    queryKey: queryKeys.parts.detail(partId ?? ''),
    queryFn: () => getPartInScope(partId ?? '', scope),
    enabled: Boolean(partId) && scope.departmentIds.length > 0,
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

  // Snapshot once so later writes cannot reset fields being edited.
  const initialValues = useMemo(
    () => (part ? partToFormValues(part) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partId],
  );

  const isSerialTaken = useCallback(
    (serialNumber: string) => isPartSerialTaken(serialNumber, partId),
    [partId],
  );

  if (!can(user, 'parts:edit')) {
    return <UnauthorizedPage />;
  }

  if (isPending) {
    return (
      <div className="max-w-2xl">
        <LoadingState label="Loading part…" />
      </div>
    );
  }

  // After a resolved fetch, so this is genuinely "no such part in your scope".
  if (!part || !initialValues) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title="Part not found"
          description={`No installed part matches the identifier "${partId ?? ''}".`}
          action={
            <Link href={registeredRoutes.parts}>
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to parts
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async (values: PartFormValues): Promise<PartFormSubmitResult> => {
    const result = await updatePart(part.id, formValuesToPartInput(values));

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

    await queryClient.invalidateQueries({ queryKey: ['parts'] });
    setLocation(partDetailPath(part.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={partDetailPath(part.id)}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to {part.partCode}
        </Button>
      </Link>

      <PageHeader
        title={`Edit ${part.partCode}`}
        description={`Update the fitted component on ${part.machineCode}.`}
      />

      {part.isArchived ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This part is removed',
            description:
              'Removed parts are read-only and kept for history. Restore it from the part page before editing.',
          }}
        />
      ) : (
        <>

          <PartForm
            mode="edit"
            initialValues={initialValues}
            machines={machines}
            isSerialTaken={isSerialTaken}
            onSubmit={handleSubmit}
            onCancel={() => setLocation(partDetailPath(part.id))}
          />
        </>
      )}
    </div>
  );
}
