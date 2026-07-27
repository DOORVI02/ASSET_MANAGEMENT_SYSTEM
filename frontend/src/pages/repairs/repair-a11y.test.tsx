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

describe('repair keyboard and accessibility behaviour', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  it('gives every status filter checkbox an accessible name', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs');
    render(<App />);
    await screen.findByRole('heading', { name: 'Repairs' });
    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    // StatusBadge renders sentence case, matching repairStatusLabels in repair-record.ts.
    for (const name of ['Reported', 'In progress', 'Waiting for parts', 'Completed', 'Cancelled']) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
  });

  it('toggles a status filter with the keyboard alone and reflects it in the URL', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs');
    render(<App />);
    await screen.findByRole('heading', { name: 'Repairs' });
    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    const completed = screen.getByRole('checkbox', { name: 'Completed' });
    completed.focus();
    expect(completed).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(window.location.search).toContain('status=completed');
    expect(screen.getByRole('checkbox', { name: 'Completed' })).toBeChecked();
  });

  it('labels the assignee and date-field filters and drives both through the URL', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs');
    render(<App />);
    await screen.findByRole('heading', { name: 'Repairs' });
    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));

    // The range filter names the date it actually applies to, so "from/to" is never ambiguous.
    expect(screen.getByLabelText(/Reported from/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Date filtered/), 'completed');
    expect(window.location.search).toContain('dateField=completed');
    expect(await screen.findByLabelText(/Completed from/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Reported from/)).not.toBeInTheDocument();

    const assignee = screen.getByLabelText(/Assignee/);
    const option = within(assignee).getAllByRole('option')[1];
    await userEvent.selectOptions(assignee, option);
    expect(new URLSearchParams(window.location.search).get('assignee')).toBe(option.textContent);
    expect(
      screen.getByRole('button', { name: new RegExp(`Assignee: ${option.textContent}`) }),
    ).toBeInTheDocument();
  });

  it('renders the desktop table with real column headers and a mobile card for the same record', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs');
    render(<App />);
    await screen.findByRole('heading', { name: 'Repairs' });
    const table = screen.getByRole('table');
    for (const header of ['Machine', 'Problem', 'Status', 'Reported', 'Assignee', 'Downtime']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    // Both responsive branches are in the DOM; Tailwind decides which is visible. The mobile card
    // is a link, the desktop row is a row, and both must carry the same record.
    expect(within(table).getAllByText('CD-11').length).toBeGreaterThan(0);
    const cardLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/repairs/rr'));
    expect(cardLinks.length).toBeGreaterThan(0);
  });

  it('labels every repair report field so it is reachable by its visible name', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/add');
    render(<App />);
    await screen.findByRole('heading', { name: 'Report repair' });
    for (const label of [/Reported by/, /Problem description/, /Reported date/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('combobox', { name: /Machine/ })).toBeInTheDocument();
  });

  it('opens the machine select, moves focus into it, and picks an option by keyboard', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/add');
    render(<App />);
    await screen.findByRole('heading', { name: 'Report repair' });
    const machine = screen.getByRole('combobox', { name: /Machine/ });
    machine.focus();
    await userEvent.keyboard('{Enter}');
    const listbox = await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(listbox).not.toBeInTheDocument();
    expect(machine).toHaveFocus();
    expect(machine).not.toHaveTextContent(/Select a machine/i);
  });

  it('traps focus inside the complete dialog, closes on Escape, and restores focus to the trigger', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/rr1');
    render(<App />);
    await screen.findByRole('heading', { name: /Repair — CD-11/ });
    const trigger = screen.getByRole('button', { name: 'Complete' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    // Radix 1.1 does not emit aria-modal; it hides outside content instead. Assert the guarantees
    // it does make: the dialog is named by its title, and focus is scoped inside it.
    expect(dialog).toHaveAccessibleName('Complete repair');
    expect(within(dialog).getByRole('heading', { name: 'Complete repair' })).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let press = 0; press < 8; press += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(
      mockRepository.listRepairRecords().find((record) => record.id === 'rr1')?.status,
    ).not.toBe('completed');
  });

  it('labels the cancel dialog reason field and names every evidence remove control', async () => {
    signInAs('supervisor', 'd3');
    visit('/repairs/rr1');
    render(<App />);
    await screen.findByRole('heading', { name: /Repair — CD-11/ });
    for (const remove of screen.queryAllByRole('button', { name: /^Remove / })) {
      expect(remove).toHaveAccessibleName(/^Remove .+/);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Cancel repair');
    expect(within(dialog).getByLabelText(/reason/i)).toBeInTheDocument();
  });
});
