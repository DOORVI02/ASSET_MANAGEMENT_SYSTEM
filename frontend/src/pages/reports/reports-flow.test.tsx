import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import { DARK_CLASS } from '@/lib/theme-storage';
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

describe('reports centre', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
    mockRepository.reset();
  });

  it('registers /reports so the sidebar link no longer reaches the not-found page', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  it('states plainly that figures are preview data and exports produce no file', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    expect(screen.getByText('Preview reports')).toBeInTheDocument();
    expect(screen.getByText(/does not generate a file yet/i)).toBeInTheDocument();
  });

  it('opens a report preview and reflects the choice in the URL', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Machine register/ }));

    expect(window.location.search).toBe('?report=machine-register');
    expect(
      await screen.findByRole('heading', { name: 'Machine register', level: 2 }),
    ).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
  });

  it('restores the selected report from the URL on load', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=repair-history');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Repair history', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Downtime (h)' })).toBeInTheDocument();
  });

  it('hides the cross-department report from a Supervisor', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    expect(screen.queryByRole('button', { name: /Department assets/ })).not.toBeInTheDocument();
  });

  it('refuses an Officer-only report requested by URL under a Supervisor session', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=department-assets');
    render(<App />);

    expect(await screen.findByText('Report not available')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Department assets', level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('offers the cross-department report to an Officer', async () => {
    signInAs('officer', 'd3');
    visit('/reports?report=department-assets');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Department assets', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Machines' })).toBeInTheDocument();
  });

  it('filters report rows by search and reflects it in the URL', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=machine-register');
    render(<App />);

    await screen.findByRole('heading', { name: 'Machine register', level: 2 });
    const before = screen.getByRole('status').textContent;

    await userEvent.type(screen.getByRole('searchbox'), 'zzzznomatch{Enter}');

    await screen.findByText('No rows match');
    expect(window.location.search).toContain('q=zzzznomatch');
    expect(screen.getByRole('status').textContent).not.toBe(before);
  });

  it('restores a search filter from the URL and offers a removable chip', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=machine-register&q=zzzznomatch');
    render(<App />);

    await screen.findByText('No rows match');
    await userEvent.click(screen.getByRole('button', { name: /Remove filter/ }));

    expect(window.location.search).toBe('?report=machine-register');
  });

  it('names the date range after the report it filters', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=repair-history');
    render(<App />);

    await screen.findByRole('heading', { name: 'Repair history', level: 2 });
    expect(screen.getByLabelText('Reported from')).toBeInTheDocument();
    expect(screen.getByLabelText('Reported to')).toBeInTheDocument();
  });

  it('offers no date range on a report with no date dimension', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=downtime');
    render(<App />);

    await screen.findByRole('heading', { name: 'Downtime', level: 2 });
    expect(screen.queryByLabelText(/ from$/)).not.toBeInTheDocument();
  });

  it('clears filters when a different report is opened', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=machine-register&q=pump');
    render(<App />);

    await screen.findByRole('heading', { name: 'Machine register', level: 2 });
    await userEvent.click(screen.getByRole('button', { name: /Repair history/ }));

    // A date range or search from one report means something else on the next.
    expect(window.location.search).toBe('?report=repair-history');
  });

  it('renders the same rows as mobile cards as well as a desktop table', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=machine-register');
    render(<App />);

    await screen.findByRole('heading', { name: 'Machine register', level: 2 });
    // jsdom has no layout, so both responsive branches are present; this proves the
    // card branch exists and carries the same column labels.
    const rowCount = screen.getAllByRole('row').length - 1;
    expect(rowCount).toBeGreaterThan(0);
    expect(screen.getAllByRole('definition').length).toBeGreaterThanOrEqual(rowCount);
  });

  it('falls back to the catalogue for an unknown report id', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports?report=not-a-report');
    render(<App />);

    expect(await screen.findByText('Report not available')).toBeInTheDocument();
  });
});

describe('theme toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
    mockRepository.reset();
  });

  it('switches the document into dark mode and persists the choice', async () => {
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /Change theme/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    expect(window.localStorage.getItem('sail_theme')).toBe('dark');
  });

  it('restores a stored dark preference on load', async () => {
    window.localStorage.setItem('sail_theme', 'dark');
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
  });

  it('marks the active preference so it is announced as selected', async () => {
    window.localStorage.setItem('sail_theme', 'light');
    signInAs('supervisor', 'd3');
    visit('/reports');
    render(<App />);

    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Change theme/ }));

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
