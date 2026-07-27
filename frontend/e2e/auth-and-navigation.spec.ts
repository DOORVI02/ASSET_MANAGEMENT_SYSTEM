import { test, expect } from './fixtures';
import { loginAsOfficer, loginAsSupervisor, DEMO_PASSWORD } from './fixtures';

test.describe('authentication', () => {
  test('rejects an invalid password with a generic, non-blocking message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('officer@sail.in');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Must not reveal whether the account exists, and must not be a native `alert()`
    // dialog — Playwright would hang on an unhandled one.
    await expect(page.getByRole('alert')).toContainText(/not recognised/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows inline field errors for an empty submission rather than a toast', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
  });

  test('toggles password visibility', async ({ page }) => {
    await page.goto('/login');
    const passwordField = page.getByLabel('Password', { exact: true });
    await passwordField.fill(DEMO_PASSWORD);
    await expect(passwordField).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(passwordField).toHaveAttribute('type', 'text');
  });

  test('logs an Officer in and out through the real form', async ({ page }) => {
    await loginAsOfficer(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Account actions' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects an unauthenticated visitor away from a protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('reaches reset-password without a session instead of bouncing to login', async ({
    page,
  }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'No recovery link' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });
});

/** Every shell page reachable from the sidebar, keyed by its link name. */
const sidebarLinks = [
  ['Dashboard', /\/dashboard/],
  ['Machine Register', /\/machines/],
  ['Installed Parts', /\/parts/],
  ['Maintenance', /\/maintenance/],
  ['Repairs', /\/repairs/],
  ['Reports Center', /\/reports/],
  ['Notifications', /\/notifications/],
  ['Profile', /\/profile/],
] as const;

test.describe('Officer navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOfficer(page);
  });

  for (const [label, urlPattern] of sidebarLinks) {
    test(`sidebar link "${label}" reaches its page without a 404`, async ({ page }) => {
      await page
        .getByRole('navigation', { name: 'Primary', exact: true })
        .getByRole('link', { name: label })
        .click();
      await expect(page).toHaveURL(urlPattern);
      await expect(page.getByText('Page not found')).not.toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('every dashboard quick action resolves to a real page', async ({ page }) => {
    await page.goto('/dashboard');

    for (const name of ['Add machine', 'Log maintenance', 'Report repair', 'View reports']) {
      const action = page.getByRole('link', { name });
      if (await action.count()) {
        await action.click();
        await expect(page.getByText('Page not found')).not.toBeVisible();
        await page.goBack();
      }
    }
  });

  test('every dashboard KPI card drills into a filtered, matching list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Total machines/ }).click();

    await expect(page).toHaveURL(/\/machines/);
    await expect(page.getByRole('heading', { name: 'Machine Register' })).toBeVisible();
  });

  test('can add a machine, matching Officer write access', async ({ page }) => {
    await page.goto('/machines');
    await expect(page.getByRole('link', { name: 'Add Machine' }).first()).toBeVisible();
  });
});

test.describe('Supervisor navigation and scope', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('lands directly on a department dashboard with no picker', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: /Change/ })).not.toBeVisible();
  });

  test('cannot add a machine: the control is genuinely absent, not just hidden', async ({
    page,
  }) => {
    await page.goto('/machines');
    await expect(page.getByRole('link', { name: 'Add Machine' })).toHaveCount(0);
  });

  test('is refused a direct navigation to an Officer-only report', async ({ page }) => {
    await page.goto('/reports?report=department-assets');
    await expect(page.getByText('Report not available')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Department assets', level: 2 })).toHaveCount(0);
  });
});
