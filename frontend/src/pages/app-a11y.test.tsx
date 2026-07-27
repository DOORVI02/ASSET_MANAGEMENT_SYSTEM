import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import type { Role } from '@/lib/types';

function signInAs(role: Role, departmentId = 'd5') {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No ${role} fixture`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
  window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

/** Every shell page a signed-in user can reach without an id parameter. */
const shellRoutes = [
  '/dashboard',
  '/machines',
  '/parts',
  '/maintenance',
  '/repairs',
  '/reports',
  '/notifications',
  '/profile',
];

describe('application-wide accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  it.each(shellRoutes)('gives %s exactly one level-1 heading', async (route) => {
    signInAs('officer');
    visit(route);
    render(<App />);

    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).not.toBe('');
  });

  it.each(shellRoutes)('exposes the shell landmarks on %s', async (route) => {
    signInAs('officer');
    visit(route);
    render(<App />);

    await screen.findAllByRole('heading', { level: 1 });
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('puts a skip link first in the tab order and points it at main', async () => {
    signInAs('officer');
    visit('/dashboard');
    render(<App />);

    await screen.findAllByRole('heading', { level: 1 });
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');

    await userEvent.tab();
    expect(skip).toHaveFocus();
  });

  it('marks the current sidebar item with aria-current', async () => {
    signInAs('officer');
    visit('/machines');
    render(<App />);

    await screen.findAllByRole('heading', { level: 1 });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Machine Register');
  });

  it('gives the auth pages a level-1 heading that does not depend on a hidden panel', async () => {
    // Login's branding panel is `hidden lg:flex`; it used to hold the only <h1>, so
    // every screen below `lg` had no level-1 heading at all.
    visit('/login');
    const login = render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Sign in to your account',
    );
    login.unmount();

    visit('/forgot-password');
    const forgot = render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Reset password');
    forgot.unmount();

    visit('/reset-password');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('No recovery link');
  });

  it('labels every theme control and reflects the active choice', async () => {
    signInAs('officer');
    visit('/dashboard');
    render(<App />);

    await screen.findAllByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Change theme/ }));

    const options = await screen.findAllByRole('menuitemradio');
    expect(options).toHaveLength(3);
    expect(options.filter((option) => option.getAttribute('aria-checked') === 'true')).toHaveLength(
      1,
    );
  });

  it('keeps the off-screen mobile drawer out of the tab order', async () => {
    signInAs('officer');
    visit('/dashboard');
    render(<App />);

    await screen.findAllByRole('heading', { level: 1 });
    const drawer = screen.getByRole('complementary', { name: 'Mobile sidebar' });
    // React renders `inert` as an attribute; its presence is what removes the subtree.
    expect(drawer).toHaveAttribute('inert');
  });
});
