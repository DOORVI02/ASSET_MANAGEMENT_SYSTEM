import { test, expect } from './fixtures';
import { loginAsOfficer } from './fixtures';

test.describe('theme toggle', () => {
  test('switches into dark mode, persists it, and survives a reload', async ({ page }) => {
    await loginAsOfficer(page);

    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.getByRole('button', { name: /Change theme/ }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    // The inline bootstrap script in index.html must apply the class before first
    // paint; if it didn't, the class would appear only after React mounts, which this
    // assertion (checked immediately after reload, before any explicit wait) would catch.
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('resolves the System preference against the OS colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await loginAsOfficer(page);

    await page.getByRole('button', { name: /Change theme/ }).click();
    await page.getByRole('menuitemradio', { name: 'System' }).click();

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('offers the auth pages a theme control even without a session', async ({ page }) => {
    await page.goto('/login');
    const toggle = page.getByRole('button', { name: /Switch to dark theme/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

/**
 * Pixel-level visual regression. Deliberately narrow: full-page screenshots across
 * every page/theme/viewport would be too brittle (data-driven counts, dates) to be
 * useful as a gate. These target chrome that should be visually stable — the shell —
 * and mask the parts of the page that legitimately vary between runs.
 */
test.describe('visual regression: shell chrome', () => {
  test('dashboard shell, light', async ({ page }) => {
    await loginAsOfficer(page);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveScreenshot(
      'sidebar-light.png',
    );
  });

  test('dashboard shell, dark', async ({ page }) => {
    await loginAsOfficer(page);
    await page.getByRole('button', { name: /Change theme/ }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).waitFor({ state: 'hidden' });

    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveScreenshot(
      'sidebar-dark.png',
    );
  });

  test('header renders consistently across a shell page', async ({ page }) => {
    await loginAsOfficer(page);
    await expect(page.getByRole('banner')).toHaveScreenshot('header-light.png', {
      // The unread notification badge and department code are legitimately data-driven.
      mask: [page.getByRole('button', { name: /Notifications/ })],
    });
  });
});
