import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import type { Role } from '@/lib/types';

function signInAs(role: Role, departmentId = 'd3') {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No ${role} fixture`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
  window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('repairs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  it('registers repair list, add, detail, and edit routes without treating add as an id', async () => {
    signInAs('supervisor');
    visit('/repairs/add');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Report repair' })).toBeInTheDocument();
    expect(screen.queryByText(/repair record not found/i)).not.toBeInTheDocument();
  });

  it('scopes repair history to the current department', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Repairs' })).toBeInTheDocument();
    expect(screen.getAllByText('CD-11').length).toBeGreaterThan(0);
    expect(screen.queryByText('OC-03')).not.toBeInTheDocument();
  });

  it('reports a repair and lands on its detail page', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/add');
    render(<App />);
    await screen.findByRole('heading', { name: 'Report repair' });
    await userEvent.click(screen.getByRole('combobox', { name: /Machine/ }));
    await userEvent.click(await screen.findByRole('option', { name: /CD-11/ }));
    await userEvent.type(screen.getByLabelText(/Reported by/), 'Shift operator');
    await userEvent.type(screen.getByLabelText(/Problem description/), 'Belt tracking is unstable');
    await userEvent.click(screen.getByRole('button', { name: 'Report repair' }));
    expect(await screen.findByRole('heading', { name: /Repair — CD-11/ })).toBeInTheDocument();
    expect(
      mockRepository
        .listRepairRecords()
        .some((record) => record.description === 'Belt tracking is unstable'),
    ).toBe(true);
  });

  it('requires completion details and lets a supervisor start and complete an open repair', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/rr1');
    render(<App />);
    await screen.findByRole('heading', { name: /Repair — CD-11/ });
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark completed' }));
    expect(await within(dialog).findByText(/Diagnosis must be at least 3/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Diagnosis'), 'Gear teeth damaged');
    await userEvent.type(
      within(dialog).getByLabelText('Resolution'),
      'Replaced gearbox and tested line',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark completed' }));
    expect(await screen.findByText(/Repair completed/i)).toBeInTheDocument();
    expect(mockRepository.listRepairRecords().find((record) => record.id === 'rr1')?.status).toBe(
      'completed',
    );
  });

  it('drives a new repair through the whole reported → completed lifecycle in the UI', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/add');
    render(<App />);
    await screen.findByRole('heading', { name: 'Report repair' });
    await userEvent.click(screen.getByRole('combobox', { name: /Machine/ }));
    await userEvent.click(await screen.findByRole('option', { name: /CD-11/ }));
    await userEvent.type(screen.getByLabelText(/Reported by/), 'Shift operator');
    await userEvent.type(screen.getByLabelText(/Problem description/), 'Drive coupling sheared');
    await userEvent.click(screen.getByRole('button', { name: 'Report repair' }));
    await screen.findByRole('heading', { name: /Repair — CD-11/ });

    const created = () =>
      mockRepository
        .listRepairRecords()
        .find((record) => record.description === 'Drive coupling sheared');
    expect(created()?.status).toBe('reported');

    // A reported repair offers Start, and must not offer Complete before work begins.
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(created()?.status).toBe('in_progress');

    await userEvent.click(await screen.findByRole('button', { name: 'Waiting for parts' }));
    expect(created()?.status).toBe('waiting_for_parts');

    await userEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(created()?.status).toBe('in_progress');

    await userEvent.click(await screen.findByRole('button', { name: 'Complete' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Diagnosis'), 'Coupling bolts fatigued');
    await userEvent.type(within(dialog).getByLabelText('Resolution'), 'Fitted new coupling');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark completed' }));
    expect(await screen.findByText(/Repair completed/i)).toBeInTheDocument();
    expect(created()?.status).toBe('completed');
    // CD-11 stays under_repair: fixture rr1 is a second open repair on the same machine, so
    // completing this one is not enough to release it. Precedence is per-machine, not per-record.
    expect(mockRepository.listMachines().find((machine) => machine.code === 'CD-11')?.status).toBe(
      'under_repair',
    );

    // A closed repair exposes no transition or edit control, so an invalid transition cannot be
    // reached from the UI at all — the repository guard in repair-repository.test.ts is the
    // second line of defence, not the only one.
    for (const name of ['Start', 'Resume', 'Complete', 'Waiting for parts', 'Cancel', 'Edit']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});
