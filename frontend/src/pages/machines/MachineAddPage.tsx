import { useCallback, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSection } from '@/components/shared/PageSection';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { Button } from '@/components/ui/button';
import { MachineForm, type MachineFormSubmitResult } from '@/components/machines/MachineForm';
import { useAuth } from '@/hooks/use-auth';
import { useDepartment } from '@/hooks/use-department';
import { can } from '@/lib/permissions';
import { createMachine, isMachineCodeTaken } from '@/lib/supabase/machines';
import {
  emptyMachineFormValues,
  formValuesToMachineInput,
  type MachineFormValues,
} from '@/lib/machine-form';
import { machineDetailPath } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MachineAddPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { available: departments } = useDepartment();
  const [initialValues] = useState<MachineFormValues>(emptyMachineFormValues);

  /**
   * An advisory check that drives the inline "code already used" message while typing. It
   * is deliberately *not* the thing that prevents a duplicate — `createMachine` relies on
   * the database's own unique constraint for that, because any check-then-insert has a race
   * between the two steps that a real concurrent database can lose.
   */
  const isCodeTaken = useCallback((code: string) => isMachineCodeTaken(code), []);

  if (!can(user, 'machine:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (values: MachineFormValues): Promise<MachineFormSubmitResult> => {
    // No `performedBy` argument: the audit trigger records `auth.uid()` server-side, so the
    // actor cannot be chosen by the caller. Passing one from the browser was exactly the
    // spoofing route the actor-spoofing verification closed.
    const result = await createMachine(formValuesToMachineInput(values));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'duplicate_code' ? 'code' : undefined,
      };
    }

    // Invalidates by prefix, so every scope and department variant of the machine list
    // refetches — not just the one this page happens to know about.
    await queryClient.invalidateQueries({ queryKey: ['machines'] });
    setLocation(machineDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/machines">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to register
        </Button>
      </Link>

      <PageHeader
        title="Add machine"
        description="Register a new machine in the plant asset register."
      />

      <MachineForm
        mode="create"
        initialValues={initialValues}
        departments={departments}
        isCodeTaken={isCodeTaken}
        onSubmit={handleSubmit}
        onCancel={() => setLocation('/machines')}
        imageSection={
          <PageSection
            title="Machine image"
            description="An image can be attached once the machine exists and has an id to attach it to."
          >
            <ImageUploader />
            <p className="mt-3 text-xs text-muted-foreground">
              Images are added from the machine&apos;s Images tab after it has been created.
            </p>
          </PageSection>
        }
      />
    </div>
  );
}
