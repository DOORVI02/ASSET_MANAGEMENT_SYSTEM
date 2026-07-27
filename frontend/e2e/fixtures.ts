import { test as base, expect, type Page } from '@playwright/test';

/**
 * Demo credentials, matching `src/lib/mock-data.ts`. Real E2E logs in through the UI —
 * the point of a browser test is to exercise the actual form, not to shortcut it by
 * seeding `localStorage` the way the Vitest suite does.
 */
export const DEMO_PASSWORD = 'Demo@1234';
export const OFFICER_EMAIL = 'officer@sail.in';
export const SUPERVISOR_EMAIL = 'supervisor@sail.in';

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/(departments|dashboard)/);
}

/** Officer accounts land on department selection first; pick the first one offered. */
export async function loginAsOfficer(page: Page): Promise<void> {
  await login(page, OFFICER_EMAIL);
  if (page.url().includes('/departments')) {
    // Department cards are `<button>`s, not links.
    await page.getByRole('main').getByRole('button').first().click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function loginAsSupervisor(page: Page): Promise<void> {
  await login(page, SUPERVISOR_EMAIL);
  await expect(page).toHaveURL(/\/dashboard/);
}

export const test = base;
export { expect };
