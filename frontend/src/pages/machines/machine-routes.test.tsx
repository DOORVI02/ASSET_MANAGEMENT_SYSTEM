import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import type { Role } from '@/lib/types';

/**
 * Signs in by seeding the same localStorage keys the providers read.
 *
 * An Officer has several authorized departments, so one must be selected or the shell
 * redirects to the department picker. `d15` is Plate Mill, which owns machine `m1`.
 */
function signInAs(role: Role, departmentId = 'd15') {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No mock user for role ${role}`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
  window.localStorage.setItem('sail_department', departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('machine routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  afterEach(() => {
    mockRepository.reset();
  });

  it('renders the register at /machines', async () => {
    signInAs('officer');
    visit('/machines');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Machine Register' })).toBeInTheDocument();
  });

  it('treats /machines/add as the add form, not a machine ID', async () => {
    signInAs('officer');
    visit('/machines/add');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Add machine' })).toBeInTheDocument();
    expect(screen.queryByText(/Machine not found/i)).not.toBeInTheDocument();
  });

  it('renders the detail page for a real machine ID', async () => {
    signInAs('officer');
    visit('/machines/m1');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'HP-04' })).toBeInTheDocument();
  });

  it('renders the edit form at /machines/:id/edit', async () => {
    signInAs('officer');
    visit('/machines/m1/edit');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Edit HP-04' })).toBeInTheDocument();
  });

  it('shows a not-found state for an unknown machine ID', async () => {
    signInAs('officer');
    visit('/machines/does-not-exist');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Machine not found' })).toBeInTheDocument();
  });

  it('shows a not-found state when editing an unknown machine ID', async () => {
    signInAs('officer');
    visit('/machines/does-not-exist/edit');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Machine not found' })).toBeInTheDocument();
  });

  describe('permissions', () => {
    it('denies a supervisor access to the add form', async () => {
      signInAs('supervisor');
      visit('/machines/add');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Access Restricted/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Add machine' })).not.toBeInTheDocument();
    });

    it('denies a supervisor access to the edit form', async () => {
      signInAs('supervisor');
      visit('/machines/m1/edit');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Access Restricted/i }),
      ).toBeInTheDocument();
    });

    it('hides the add action from a supervisor on the register', async () => {
      signInAs('supervisor');
      visit('/machines');
      render(<App />);

      await screen.findByRole('heading', { name: 'Machine Register' });
      expect(screen.queryByRole('link', { name: /Add Machine/i })).not.toBeInTheDocument();
    });

    it('hides edit and archive actions from a supervisor on machine detail', async () => {
      signInAs('supervisor');
      // CD-11 is in Coal Handling, the Supervisor's own department.
      visit('/machines/m6');
      render(<App />);

      await screen.findByRole('heading', { name: 'CD-11' });
      expect(screen.queryByRole('link', { name: /^Edit$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Archive/i })).not.toBeInTheDocument();
    });

    it('offers edit and archive actions to an officer on machine detail', async () => {
      signInAs('officer');
      visit('/machines/m1');
      render(<App />);

      await screen.findByRole('heading', { name: 'HP-04' });
      expect(screen.getByRole('link', { name: /Edit/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archive/i })).toBeInTheDocument();
    });
  });

  describe('machine detail tabs', () => {
    beforeEach(() => {
      signInAs('officer');
      visit('/machines/m1');
    });

    it('shows machine-scoped parts instead of a placeholder', async () => {
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Parts' }));

      // The responsive layout renders both a desktop table and mobile cards.
      expect((await screen.findAllByText('HF-220')).length).toBeGreaterThan(0);
      expect(screen.queryByText(/will be displayed here/i)).not.toBeInTheDocument();
    });

    it('shows the single machine image instead of a placeholder', async () => {
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Image' }));

      expect(await screen.findByRole('heading', { name: 'Machine image' })).toBeInTheDocument();
      expect(screen.getByText('hydraulic-press-front.svg')).toBeInTheDocument();
      // One image per machine: no gallery affordances.
      expect(screen.queryByText(/Additional images/i)).not.toBeInTheDocument();
    });

    it('shows typed audit events instead of hard-coded activity', async () => {
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('tab', { name: 'Activity' }));

      expect(await screen.findByText('Machine created')).toBeInTheDocument();
      expect(screen.getByText(/Machine HP-04 registered/)).toBeInTheDocument();
    });

    it('shows an empty parts state for a machine with no parts', async () => {
      // PM-DS-03 is in the selected department and has no fitted components.
      visit('/machines/m65');
      render(<App />);
      await screen.findByRole('heading', { name: 'PM-DS-03' });

      await userEvent.click(screen.getByRole('tab', { name: 'Parts' }));

      expect(
        await screen.findByRole('heading', { name: /No parts linked to this machine/i }),
      ).toBeInTheDocument();
    });
  });

  describe('archive workflow', () => {
    it('archives a machine, updates the detail page, and removes it from the register', async () => {
      signInAs('officer');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      await userEvent.click(screen.getByRole('button', { name: /Archive/i }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Archive machine' }));

      // The detail page reflects the archive rather than only showing a toast.
      expect(await screen.findByText('HP-04 archived')).toBeInTheDocument();
      expect(screen.getByText(/This machine is archived/i)).toBeInTheDocument();
      expect(mockRepository.getMachine('m1')).toMatchObject({
        isArchived: true,
        status: 'retired',
      });

      // Editing is withdrawn while archived, and Restore is offered instead.
      expect(screen.queryByRole('link', { name: /^Edit$/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore/i })).toBeInTheDocument();
    });

    it('offers no permanent delete action', async () => {
      signInAs('officer');
      visit('/machines/m1');
      render(<App />);
      await screen.findByRole('heading', { name: 'HP-04' });

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('create and edit workflows', () => {
    it('creates a machine from the form and lands on its detail page', async () => {
      signInAs('officer');
      visit('/machines/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Add machine' });

      await userEvent.type(screen.getByLabelText(/Machine code/), 'NEW-77');
      await userEvent.type(screen.getByLabelText(/Machine name/), 'Test Bench Pump');
      await userEvent.type(screen.getByLabelText(/Manufacturer/), 'Acme Industrial');
      await userEvent.type(screen.getByLabelText(/^Model/), 'AB-12');
      await userEvent.type(screen.getByLabelText(/^Location/), 'Bay 12');
      await userEvent.type(screen.getByLabelText(/Next maintenance date/), '2027-01-15');

      // Radix Select is keyboard driven; open it and pick the first department.
      await userEvent.click(screen.getByRole('combobox', { name: /Department/ }));
      expect(await screen.findByRole('listbox')).toHaveClass('max-h-80', 'overflow-y-auto');
      await userEvent.click(await screen.findByRole('option', { name: /Sinter Plant 3/ }));

      await userEvent.click(screen.getByRole('button', { name: 'Create machine' }));

      expect(await screen.findByRole('heading', { name: 'NEW-77' })).toBeInTheDocument();
      expect(mockRepository.listMachines().some((machine) => machine.code === 'NEW-77')).toBe(true);
    });

    it('blocks submission and reports a duplicate machine code', async () => {
      signInAs('officer');
      visit('/machines/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Add machine' });

      await userEvent.type(screen.getByLabelText(/Machine code/), 'HP-04');
      await userEvent.tab();

      expect(
        await screen.findByText(/Another machine already uses this code/i),
      ).toBeInTheDocument();

      const machineCountBefore = mockRepository.listMachines().length;
      await userEvent.click(screen.getByRole('button', { name: 'Create machine' }));

      expect(mockRepository.listMachines()).toHaveLength(machineCountBefore);
    });

    it('reports validation failures instead of silently succeeding', async () => {
      signInAs('officer');
      visit('/machines/add');
      render(<App />);
      await screen.findByRole('heading', { name: 'Add machine' });

      await userEvent.click(screen.getByRole('button', { name: 'Create machine' }));

      expect(await screen.findByText(/need attention/i)).toBeInTheDocument();
      expect(mockRepository.listMachines().some((m) => m.code === '')).toBe(false);
    });

    it('saves an edit into the preview store and shows it on the detail page', async () => {
      signInAs('officer');
      visit('/machines/m1/edit');
      render(<App />);
      await screen.findByRole('heading', { name: 'Edit HP-04' });

      const nameField = screen.getByLabelText(/Machine name/);
      await userEvent.clear(nameField);
      await userEvent.type(nameField, 'Hydraulic Press Refurbished');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByRole('heading', { name: 'HP-04' })).toBeInTheDocument();
      expect(screen.getAllByText('Hydraulic Press Refurbished').length).toBeGreaterThan(0);
      expect(mockRepository.getMachine('m1')?.name).toBe('Hydraulic Press Refurbished');
    });

    it('warns before discarding unsaved edits on cancel', async () => {
      signInAs('officer');
      visit('/machines/m1/edit');
      render(<App />);
      await screen.findByRole('heading', { name: 'Edit HP-04' });

      expect(screen.getByText('No unsaved changes')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/Machine name/), ' Updated');
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(
        await screen.findByRole('heading', { name: /Discard unsaved changes/i }),
      ).toBeInTheDocument();
    });
  });
});
