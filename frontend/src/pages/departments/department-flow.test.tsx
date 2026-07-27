import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import type { Role } from '@/lib/types';

function signInAs(role: Role) {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No mock user for role ${role}`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
}

function selectDepartment(departmentId: string) {
  window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('department scoping', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  describe('officer selection', () => {
    it('redirects an officer with no department to the picker', async () => {
      signInAs('officer');
      visit('/dashboard');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Select a department/i }),
      ).toBeInTheDocument();
    });

    it("lists only the officer's associated departments, not all of them", async () => {
      signInAs('officer');
      visit('/departments');
      render(<App />);

      await screen.findByRole('heading', { name: /Select a department/i });

      const officer = mockUsers['officer@sail.in'];
      const options = screen.getAllByRole('button', { name: /machines/i });
      expect(options).toHaveLength(officer.departmentScope.length);
      expect(officer.departmentScope.length).toBeLessThan(mockRepository.listDepartments().length);

      // A department outside the officer's scope must not appear.
      expect(screen.queryByText('Wire Rod Mill')).not.toBeInTheDocument();
    });

    it('selecting a department opens its scoped dashboard', async () => {
      signInAs('officer');
      visit('/departments');
      render(<App />);
      await screen.findByRole('heading', { name: /Select a department/i });

      await userEvent.click(screen.getByText('Plate Mill'));

      expect(
        await screen.findByRole('heading', { name: /Plate Mill dashboard/i }),
      ).toBeInTheDocument();
    });

    it('persists the selection so it survives a fresh app load', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Plate Mill dashboard/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /Select a department/i }),
      ).not.toBeInTheDocument();
    });

    it('falls back to selection when the stored department is no longer in scope', async () => {
      signInAs('officer');
      // d13 is Wire Rod Mill, outside this officer's scope.
      selectDepartment('d13');
      visit('/dashboard');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Select a department/i }),
      ).toBeInTheDocument();
    });

    it('offers a change-department control to an officer', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      await userEvent.click(screen.getByRole('button', { name: /Change department/i }));

      expect(
        await screen.findByRole('heading', { name: /Select a department/i }),
      ).toBeInTheDocument();
    });

    it('does not strand the officer: Change keeps the current department selected', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      await userEvent.click(screen.getByRole('button', { name: /Change department/i }));
      await screen.findByRole('heading', { name: /Select a department/i });

      // The prior department must still be current, not cleared, so Back can return to it
      // and the shell's "must pick a department" guard does not trap the user here.
      expect(screen.getByRole('button', { name: /Back to PM dashboard/i })).toBeInTheDocument();
    });

    it('offers a Back action that returns to the dashboard without changing the department', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      await userEvent.click(screen.getByRole('button', { name: /Change department/i }));
      await screen.findByRole('heading', { name: /Select a department/i });

      await userEvent.click(screen.getByRole('button', { name: /Back to PM dashboard/i }));

      expect(
        await screen.findByRole('heading', { name: /Plate Mill dashboard/i }),
      ).toBeInTheDocument();
    });

    it('offers no Back action on first sign-in with no department chosen yet', async () => {
      signInAs('officer');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Select a department/i });

      expect(screen.queryByRole('button', { name: /^Back to/i })).not.toBeInTheDocument();
    });
  });

  describe('supervisor lock', () => {
    it('routes a supervisor straight to their department with no picker', async () => {
      signInAs('supervisor');
      visit('/dashboard');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /Coal Handling dashboard/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /Select a department/i }),
      ).not.toBeInTheDocument();
    });

    it('offers no change-department control to a supervisor', async () => {
      signInAs('supervisor');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Coal Handling dashboard/i });

      expect(screen.queryByRole('button', { name: /Change department/i })).not.toBeInTheDocument();
    });

    it("ignores a stored department outside the supervisor's single assignment", async () => {
      signInAs('supervisor');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);

      // The assignment wins over whatever is stored.
      expect(
        await screen.findByRole('heading', { name: /Coal Handling dashboard/i }),
      ).toBeInTheDocument();
    });

    it('scopes the register to the supervisor department only', async () => {
      signInAs('supervisor');
      visit('/machines');
      render(<App />);

      await screen.findByRole('heading', { name: 'Machine Register' });

      // CD-11 is in Coal Handling; HP-04 is in Plate Mill.
      expect(screen.getAllByText('CD-11').length).toBeGreaterThan(0);
      expect(screen.queryByText('HP-04')).not.toBeInTheDocument();
    });

    it('refuses a machine outside the supervisor department', async () => {
      signInAs('supervisor');
      visit('/machines/m1');
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Machine not found' })).toBeInTheDocument();
    });
  });

  describe('dashboard drill-through', () => {
    it('carries the status filter into the register URL and applies it', async () => {
      signInAs('officer');
      selectDepartment('d16');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Power Plants dashboard/i });

      await userEvent.click(screen.getByRole('link', { name: /^Active:/ }));

      await screen.findByRole('heading', { name: 'Machine Register' });
      expect(window.location.search).toContain('status=active');
      // The applied filter is visible as a removable chip.
      expect(screen.getByRole('button', { name: /Remove active filter/i })).toBeInTheDocument();
    });

    it('applies a status filter taken straight from the URL', async () => {
      signInAs('officer');
      selectDepartment('d16');
      visit('/machines?status=retired');
      render(<App />);

      await screen.findByRole('heading', { name: 'Machine Register' });
      expect(screen.getByRole('button', { name: /Remove retired filter/i })).toBeInTheDocument();
    });

    it('shows the department scope as a chip on the register', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/machines');
      render(<App />);

      await screen.findByRole('heading', { name: 'Machine Register' });
      expect(screen.getByText(/Department: PM/)).toBeInTheDocument();
    });
  });

  describe('archived visibility', () => {
    it('shows an archived machine to an officer', async () => {
      signInAs('officer');
      selectDepartment('d16');
      visit('/machines?status=retired');
      render(<App />);

      await screen.findByRole('heading', { name: 'Machine Register' });
      // CB-05 is archived and retired, in Power Plants.
      expect(screen.getAllByText('CB-05').length).toBeGreaterThan(0);
    });

    it('hides archived machines from a supervisor entirely', async () => {
      const supervisorMachines = mockRepository.listMachinesForDepartment('d16', {
        departmentIds: ['d16'],
        includeArchived: false,
      });

      expect(supervisorMachines.some((machine) => machine.code === 'CB-05')).toBe(false);
    });
  });

  describe('officer department filter', () => {
    it('offers an associated-departments filter to an officer', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/machines');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      await userEvent.click(screen.getByRole('button', { name: /Filters/i }));

      expect(
        await screen.findByRole('heading', { name: /Associated departments/i }),
      ).toBeInTheDocument();
    });

    it('offers no department filter to a supervisor', async () => {
      signInAs('supervisor');
      visit('/machines');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      await userEvent.click(screen.getByRole('button', { name: /Filters/i }));

      expect(
        screen.queryByRole('heading', { name: /Associated departments/i }),
      ).not.toBeInTheDocument();
    });

    it('widens the list across two associated departments from the URL', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/machines?dept=d15,d16');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      // HP-04 is in Plate Mill, CWP-08 is in Power Plants.
      expect(screen.getAllByText('HP-04').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CWP-08').length).toBeGreaterThan(0);
    });

    it('ignores a department outside the officer scope in the URL', async () => {
      signInAs('officer');
      selectDepartment('d15');
      // d13 is Wire Rod Mill, outside this officer's associated departments.
      visit('/machines?dept=d15,d13');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      expect(screen.getAllByText('HP-04').length).toBeGreaterThan(0);
      expect(screen.queryByText('WRM-BM-02')).not.toBeInTheDocument();
    });

    it('shows a removable chip per filtered department', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/machines?dept=d15,d16');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      expect(
        screen.getByRole('button', { name: /Remove PM department filter/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Remove PP department filter/i }),
      ).toBeInTheDocument();
    });

    it('a supervisor cannot widen scope with a dept parameter', async () => {
      signInAs('supervisor');
      visit('/machines?dept=d15,d16');
      render(<App />);
      await screen.findByRole('heading', { name: 'Machine Register' });

      // The supervisor's single department wins; Plate Mill machines stay hidden.
      expect(screen.queryByText('HP-04')).not.toBeInTheDocument();
      expect(screen.getAllByText('CD-11').length).toBeGreaterThan(0);
    });
  });

  describe('profile navigation', () => {
    it('opens the profile page from the header avatar and name', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      // The sidebar footer has a matching link too; scope to the header explicitly.
      const header = screen.getByRole('banner');
      await userEvent.click(within(header).getByRole('link', { name: /Rajesh Verma/i }));

      expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    });

    it('still offers logout via the account menu caret, separate from the profile link', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      await userEvent.click(screen.getByRole('button', { name: /Account actions/i }));

      expect(await screen.findByRole('menuitem', { name: /Log out/i })).toBeInTheDocument();
    });

    it('opens the profile page from the sidebar footer', async () => {
      signInAs('officer');
      selectDepartment('d15');
      visit('/dashboard');
      render(<App />);
      await screen.findByRole('heading', { name: /Plate Mill dashboard/i });

      const sidebar = screen.getByRole('complementary', { name: 'Primary sidebar' });
      await userEvent.click(within(sidebar).getByRole('link', { name: /Rajesh Verma/i }));

      expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    });
  });
});
