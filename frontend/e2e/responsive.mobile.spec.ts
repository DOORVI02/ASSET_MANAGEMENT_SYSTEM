import { test, expect } from './fixtures';
import { loginAsOfficer } from './fixtures';

/**
 * Runs under the `mobile-chromium` project (`iPhone 13`, ~390×844 CSS px) — see
 * `playwright.config.ts`. This is the first **genuine** mobile-viewport check in the
 * project: earlier passes used headless Chrome's `--window-size` flag, which macOS
 * silently floors to a wider minimum, so those screenshots were never true mobile
 * captures. A real device profile has no such floor.
 */
const shellPages = [
  ['/dashboard', 'Dashboard'],
  ['/machines', 'Machine Register'],
  ['/parts', 'Installed Parts'],
  ['/maintenance', 'Maintenance'],
  ['/repairs', 'Repairs'],
  ['/reports', 'Reports'],
  ['/notifications', 'Notifications'],
] as const;

test.describe('mobile layout has no horizontal overflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOfficer(page);
  });

  for (const [path, heading] of shellPages) {
    test(`${path} fits the viewport width`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test('the sidebar collapses to a drawer behind the menu button', async ({ page }) => {
    await page.goto('/dashboard');
    // The full-width desktop sidebar must not be visible at a phone width. `exact` is
    // required — 'Primary' otherwise substring-matches the drawer's 'Primary (mobile)'.
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const drawer = page.getByRole('navigation', { name: 'Primary (mobile)' });
    await expect(drawer).toBeVisible();
  });

  test('a list page shows cards, not a wide table, at phone width', async ({ page }) => {
    await page.goto('/machines');
    // The desktop table branch is `hidden` below `lg`; Playwright's visibility check
    // respects computed style, so this fails if the responsive class ever regresses.
    await expect(page.getByRole('table')).not.toBeVisible();
  });
});
