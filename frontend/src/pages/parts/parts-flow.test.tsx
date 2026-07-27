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

describe('installed parts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  describe('routing', () => {
    it('renders the parts list at /parts', async () => {
      signInAs('officer');
      visit('/parts');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Installed Parts' })).toBeInTheDocument();
    });

    it('treats /parts/add as the form, not a part id', async () => {
      signInAs('officer');
      visit('/parts/add');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Fit part' })).toBeInTheDocument();
      expect(screen.queryByText(/Part not found/i)).not.toBeInTheDocument();
    });

    it('renders part detail for a real id', async () => {
      signInAs('officer');
      visit('/parts/p1');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'HF-220' })).toBeInTheDocument();
    });

    it('renders the part edit form for a real id', async () => {
      signInAs('officer');
      visit('/parts/p1/edit');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Edit HF-220' })).toBeInTheDocument();
    });

    it('shows a not-found state for an unknown part id', async () => {
      signInAs('officer');
      visit('/parts/does-not-exist');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Part not found' })).toBeInTheDocument();
    });
  });

  describe('no inventory semantics remain', () => {
    it('shows no stock columns or stock states on the list', async () => {
      signInAs('officer');
      visit('/parts');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      expect(screen.queryByText(/min stock/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/low stock/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/out of stock/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/restock/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/supplier/i)).not.toBeInTheDocument();
    });

    it('shows installed-part columns instead', async () => {
      signInAs('officer');
      visit('/parts');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      expect(screen.getByRole('columnheader', { name: /Position/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Fitted/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Replacement/i })).toBeInTheDocument();
    });
  });

  describe('department scoping', () => {
    it('lists only parts on machines in the current department', async () => {
      signInAs('officer', 'd15');
      visit('/parts');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      // HF-220 is on HP-04 in Plate Mill; GB-450 is on CD-11 in Coal Handling.
      expect(screen.getAllByText('HF-220').length).toBeGreaterThan(0);
      expect(screen.queryByText('GB-450')).not.toBeInTheDocument();
    });

    it('refuses a part on a machine outside the supervisor department', async () => {
      signInAs('supervisor');
      visit('/parts/p1');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Part not found' })).toBeInTheDocument();
    });

    it('shows the supervisor their own department parts', async () => {
      signInAs('supervisor');
      visit('/parts/p9');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'GB-450' })).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('offers a supervisor the fit-part action, since parts are shared write', async () => {
      signInAs('supervisor');
      visit('/parts');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      expect(screen.getByRole('link', { name: /Fit part/i })).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('applies a machine filter taken from the URL', async () => {
      signInAs('officer', 'd15');
      visit('/parts?machine=m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      expect(screen.getByRole('button', { name: /Remove machine filter/i })).toBeInTheDocument();
      expect(screen.getAllByText('HF-220').length).toBeGreaterThan(0);
      // PM-RF-02's burner nozzle lives on a different machine in the same department.
      expect(screen.queryByText('BN-510')).not.toBeInTheDocument();
    });

    it('applies a category filter taken from the URL', async () => {
      signInAs('officer', 'd15');
      visit('/parts?category=Seals');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      expect(screen.getByRole('button', { name: /Remove Seals filter/i })).toBeInTheDocument();
      expect(screen.getAllByText('SL-118').length).toBeGreaterThan(0);
      expect(screen.queryByText('HF-220')).not.toBeInTheDocument();
    });

    it('applies a replacement-state filter and clears it', async () => {
      signInAs('officer', 'd15');
      visit('/parts?life=overdue');
      render(<App />);
      await screen.findByRole('heading', { name: 'Installed Parts' });

      const chip = screen.getByRole('button', { name: /Remove overdue filter/i });
      await userEvent.click(chip);

      expect(window.location.search).not.toContain('life=overdue');
    });
  });

  describe('fit, edit, replace, remove', () => {
    it('fits a part and lands on its detail page', async () => {
      signInAs('officer', 'd15');
      visit('/parts/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Fit part' });

      await userEvent.click(screen.getByRole('combobox', { name: /Machine/ }));
      await userEvent.click(await screen.findByRole('option', { name: /HP-04/ }));

      await userEvent.type(screen.getByLabelText(/Part code/), 'TST-99');
      await userEvent.type(screen.getByLabelText(/Part name/), 'Test Bearing Unit');
      await userEvent.type(screen.getByLabelText(/Position on machine/), 'Drive end');

      await userEvent.click(screen.getByRole('button', { name: 'Fit part' }));

      expect(await screen.findByRole('heading', { name: 'TST-99' })).toBeInTheDocument();
      expect(mockRepository.listParts().some((part) => part.partCode === 'TST-99')).toBe(true);
    });

    it('blocks a duplicate serial number before submitting', async () => {
      signInAs('officer', 'd15');
      visit('/parts/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Fit part' });

      const existing = mockRepository.listParts().find((part) => part.serialNumber);
      await userEvent.type(screen.getByLabelText(/Serial number/), existing!.serialNumber!);
      await userEvent.tab();

      expect(
        await screen.findByText(/Another part already uses this serial number/i),
      ).toBeInTheDocument();
    });

    it('reports validation failures instead of silently succeeding', async () => {
      signInAs('officer', 'd15');
      visit('/parts/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Fit part' });

      const before = mockRepository.listParts().length;
      await userEvent.click(screen.getByRole('button', { name: 'Fit part' }));

      expect(await screen.findByText(/need attention/i)).toBeInTheDocument();
      expect(mockRepository.listParts()).toHaveLength(before);
    });

    it('saves an edit into the preview store', async () => {
      signInAs('officer', 'd15');
      visit('/parts/p1/edit');
      render(<App />);
      await screen.findByRole('heading', { name: 'Edit HF-220' });

      const nameField = screen.getByLabelText(/Part name/);
      await userEvent.clear(nameField);
      await userEvent.type(nameField, 'Hydraulic Filter Mk2');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByRole('heading', { name: 'HF-220' })).toBeInTheDocument();
      expect(
        mockRepository.getPartInScope('p1', {
          departmentIds: ['d15'],
          includeArchived: true,
        })?.partName,
      ).toBe('Hydraulic Filter Mk2');
    });

    it('records a replacement and shows it in the history', async () => {
      signInAs('officer', 'd15');
      visit('/parts/p1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HF-220' });

      await userEvent.click(screen.getByRole('button', { name: /Replace/i }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(
        within(dialog).getByLabelText(/Reason/),
        'Element collapsed under back pressure',
      );
      await userEvent.click(within(dialog).getByRole('button', { name: /Record replacement/i }));

      expect(await screen.findByText(/HF-220 replaced/i)).toBeInTheDocument();
      expect(screen.getByText(/Element collapsed under back pressure/i)).toBeInTheDocument();
    });

    it('rejects a replacement with no reason', async () => {
      signInAs('officer', 'd15');
      visit('/parts/p1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HF-220' });

      await userEvent.click(screen.getByRole('button', { name: /Replace/i }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /Record replacement/i }));

      expect(await within(dialog).findByText(/Reason must be at least 3/i)).toBeInTheDocument();
    });

    it('removes a part and offers restore instead of edit', async () => {
      signInAs('officer', 'd15');
      visit('/parts/p1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HF-220' });

      await userEvent.click(screen.getByRole('button', { name: /Remove/i }));
      const confirm = await screen.findByRole('alertdialog');
      await userEvent.click(within(confirm).getByRole('button', { name: 'Remove part' }));

      expect(await screen.findByText(/HF-220 removed/i)).toBeInTheDocument();
      expect(screen.getAllByText(/no longer fitted/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Restore/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Edit$/ })).not.toBeInTheDocument();
    });
  });

  describe('machine detail integration', () => {
    it('links machine parts through to the part page', async () => {
      signInAs('officer', 'd15');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Parts' }));

      const link = (await screen.findAllByRole('link', { name: 'HF-220' }))[0];
      await userEvent.click(link);

      expect(await screen.findByRole('heading', { name: 'HF-220' })).toBeInTheDocument();
    });

    it('offers a scoped fit-part action from the machine Parts tab', async () => {
      signInAs('officer', 'd15');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Parts' }));

      const action = await screen.findByRole('link', { name: /Fit part to this machine/i });
      expect(action).toHaveAttribute('href', '/parts/add?machine=m1');
    });
  });
});
