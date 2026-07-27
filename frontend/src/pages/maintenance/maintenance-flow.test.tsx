import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import type { Role } from '@/lib/types';

function signInAs(role: Role, departmentId = 'd15') {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No mock user for role ${role}`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
  window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('maintenance', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  describe('routing', () => {
    it('renders the maintenance page at /maintenance', async () => {
      signInAs('officer');
      visit('/maintenance');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
    });

    it('treats /maintenance/add as the log form, not a record id', async () => {
      signInAs('officer');
      visit('/maintenance/add');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Log maintenance' })).toBeInTheDocument();
      expect(screen.queryByText(/record not found/i)).not.toBeInTheDocument();
    });

    it('treats /maintenance/plans/add as the plan form, not a record id', async () => {
      signInAs('officer');
      visit('/maintenance/plans/add');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: 'New recurring plan' }),
      ).toBeInTheDocument();
    });

    it('renders detail and edit for a real record id', async () => {
      signInAs('officer');
      visit('/maintenance/mr1');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: 'Preventive maintenance' }),
      ).toBeInTheDocument();
    });

    it('shows a not-found state for an unknown record id', async () => {
      signInAs('officer');
      visit('/maintenance/does-not-exist');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: 'Maintenance record not found' }),
      ).toBeInTheDocument();
    });
  });

  describe('plan/record separation', () => {
    it('keeps records and plans on distinct tabs', async () => {
      signInAs('officer');
      visit('/maintenance');
      render(<App />);
      await screen.findByRole('heading', { name: 'Maintenance' });

      expect(screen.getByRole('tab', { name: 'Records' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Plans' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('tab', { name: 'Plans' }));
      expect(await screen.findByText(/Every 1 month/i)).toBeInTheDocument();
    });
  });

  describe('department scoping', () => {
    it('lists only records on machines in the current department', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance');
      render(<App />);
      await screen.findByRole('heading', { name: 'Maintenance' });

      // HP-04 is in Plate Mill; RM-12 is in Rail & Structural Mill.
      expect(screen.getAllByText('HP-04').length).toBeGreaterThan(0);
      expect(screen.queryByText('RM-12')).not.toBeInTheDocument();
    });

    it('refuses a record on a machine outside the supervisor department', async () => {
      signInAs('supervisor');
      visit('/maintenance/mr1');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: 'Maintenance record not found' }),
      ).toBeInTheDocument();
    });

    it('shows the supervisor their own department record', async () => {
      signInAs('supervisor');
      visit('/maintenance/mr6');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: 'Corrective maintenance' }),
      ).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('offers both officer and supervisor the log-maintenance action', async () => {
      signInAs('supervisor');
      visit('/maintenance');
      render(<App />);
      await screen.findByRole('heading', { name: 'Maintenance' });

      expect(screen.getByRole('link', { name: /Log maintenance/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /New plan/i })).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('applies a status filter from the URL', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance?status=scheduled');
      render(<App />);
      await screen.findByRole('heading', { name: 'Maintenance' });

      expect(screen.getByRole('button', { name: /Remove Scheduled filter/i })).toBeInTheDocument();
    });

    it('applies a due-soon filter and shows only open due-soon records', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance?due=soon');
      render(<App />);
      await screen.findByRole('heading', { name: 'Maintenance' });

      expect(
        screen.getByRole('button', { name: /Remove Due within 15 days filter/i }),
      ).toBeInTheDocument();
    });
  });

  describe('schedule, transition, and reopen lifecycle', () => {
    it('schedules a record and lands on its detail page', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Log maintenance' });

      await userEvent.click(screen.getByRole('combobox', { name: /Machine/ }));
      await userEvent.click(await screen.findByRole('option', { name: /HP-04/ }));
      await userEvent.click(screen.getByRole('combobox', { name: /Technician/ }));
      await userEvent.click(await screen.findByRole('option', { name: /R\. Kumar/ }));
      await userEvent.type(screen.getByLabelText(/Description/), 'Test scheduled maintenance');

      await userEvent.click(screen.getByRole('button', { name: 'Schedule maintenance' }));

      expect(
        await screen.findByRole('heading', { name: 'Preventive maintenance' }),
      ).toBeInTheDocument();
      expect(
        mockRepository
          .listMaintenanceRecords()
          .some((record) => record.description === 'Test scheduled maintenance'),
      ).toBe(true);
    });

    it('reports validation failures instead of silently succeeding', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Log maintenance' });

      const before = mockRepository.listMaintenanceRecords().length;
      await userEvent.click(screen.getByRole('button', { name: 'Schedule maintenance' }));

      expect(await screen.findByText(/need attention/i)).toBeInTheDocument();
      expect(mockRepository.listMaintenanceRecords()).toHaveLength(before);
    });

    it('starts, completes, and reopens a record from the detail page', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/mr1');
      render(<App />);
      await screen.findByRole('heading', { name: 'Preventive maintenance' });

      await userEvent.click(screen.getByRole('button', { name: /^Start$/ }));
      expect(await screen.findByText(/Maintenance started/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^Complete$/ }));
      const completeDialog = await screen.findByRole('dialog');
      await userEvent.type(
        within(completeDialog).getByLabelText(/Actions taken/),
        'Replaced filter element',
      );
      await userEvent.click(
        within(completeDialog).getByRole('button', { name: /Mark completed/i }),
      );
      expect(await screen.findByText(/Maintenance completed/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^Reopen$/ }));
      const reopenConfirm = await screen.findByRole('alertdialog');
      await userEvent.click(within(reopenConfirm).getByRole('button', { name: 'Reopen' }));
      expect(await screen.findByText(/Maintenance reopened/i)).toBeInTheDocument();

      expect(
        mockRepository.getMaintenanceRecordInScope('mr1', {
          departmentIds: ['d15'],
          includeArchived: true,
        })?.status,
      ).toBe('in_progress');
    });

    it('cancels a scheduled record with a reason', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/mr1');
      render(<App />);
      await screen.findByRole('heading', { name: 'Preventive maintenance' });

      await userEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Reason/), 'No longer required');
      await userEvent.click(within(dialog).getByRole('button', { name: /Cancel maintenance/i }));

      expect(await screen.findByText(/Maintenance cancelled/i)).toBeInTheDocument();
    });

    it('rejects completing with no actions recorded', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/mr1');
      render(<App />);
      await screen.findByRole('heading', { name: 'Preventive maintenance' });

      await userEvent.click(screen.getByRole('button', { name: /^Complete$/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /Mark completed/i }));

      expect(
        await within(dialog).findByText(/Actions taken must be at least 3/i),
      ).toBeInTheDocument();
    });

    it('hides transition actions on a closed record', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/mr3');
      render(<App />);
      await screen.findByRole('heading', { name: 'Lubrication maintenance' });

      expect(screen.queryByRole('button', { name: /^Start$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Complete$/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Reopen$/ })).toBeInTheDocument();
    });
  });

  describe('plans', () => {
    it('creates a plan and returns to the plans tab', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/plans/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'New recurring plan' });

      await userEvent.click(screen.getByRole('combobox', { name: /Machine/ }));
      await userEvent.click(await screen.findByRole('option', { name: /HP-04/ }));
      await userEvent.type(screen.getByLabelText(/Description/), 'Test recurring plan');

      await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));

      expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
      expect(
        mockRepository
          .listMaintenancePlansForMachine('m1')
          .some((plan) => plan.description === 'Test recurring plan'),
      ).toBe(true);
    });

    it('archives a plan and offers restore instead of edit', async () => {
      signInAs('officer', 'd15');
      visit('/maintenance/plans/plan1/edit');
      const first = render(<App />);
      await screen.findByRole('heading', { name: 'Edit preventive plan' });

      await userEvent.click(screen.getByRole('button', { name: /Archive plan/i }));
      const confirm = await screen.findByRole('alertdialog');
      await userEvent.click(within(confirm).getByRole('button', { name: 'Archive plan' }));

      // Archiving navigates back to the plans list rather than showing inline feedback.
      await screen.findByRole('heading', { name: 'Maintenance' });
      expect(
        mockRepository.getMaintenancePlanInScope('plan1', {
          departmentIds: ['d15'],
          includeArchived: true,
        })?.isArchived,
      ).toBe(true);
      first.unmount();

      visit('/maintenance/plans/plan1/edit');
      render(<App />);
      expect(await screen.findByText(/This plan is archived/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore/i })).toBeInTheDocument();
    });
  });

  describe('machine detail integration', () => {
    it('links a maintenance row on the machine tab through to its detail page', async () => {
      signInAs('officer', 'd15');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Maintenance' }));
      const link = await screen.findByRole('link', { name: /preventive/i });
      await userEvent.click(link);

      expect(
        await screen.findByRole('heading', { name: 'Preventive maintenance' }),
      ).toBeInTheDocument();
    });

    it('offers a scoped log-maintenance action from the machine tab', async () => {
      signInAs('officer', 'd15');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Maintenance' }));
      const action = await screen.findByRole('link', { name: /Log maintenance for this machine/i });
      expect(action).toHaveAttribute('href', '/maintenance/add?machine=m1');
    });
  });

  describe('dashboard integration', () => {
    it('links an upcoming-maintenance row through to its detail page', async () => {
      signInAs('officer', 'd15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      const link = screen.getByRole('link', { name: /HP-04 - preventive/i });
      expect(link).toHaveAttribute('href', '/maintenance/mr1');
    });
  });
});
